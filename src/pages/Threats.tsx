import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface Threat {
  id: string;
  threat_type: string;
  severity: string;
  description: string;
  source_ip: string | null;
  destination_ip: string | null;
  port: number | null;
  confidence_score: number | null;
  detected_at: string;
}

export default function Threats() {
  const { user, isAdmin } = useAuth();
  const [threats, setThreats] = useState<Threat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    byType: {} as Record<string, number>
  });

  useEffect(() => {
    if (!user) return;
    fetchThreats();
  }, [user, isAdmin]);

  const fetchThreats = async () => {
    try {
      let query = supabase.from("threats").select(`
        *,
        logs!inner(user_id)
      `);

      if (!isAdmin) {
        query = query.eq("logs.user_id", user!.id);
      }

      const { data, error } = await query.order("detected_at", { ascending: false });

      if (error) throw error;

      setThreats(data as any);
      
      // Calculate statistics
      const byType: Record<string, number> = {};
      data.forEach((t: any) => {
        byType[t.threat_type] = (byType[t.threat_type] || 0) + 1;
      });
      
      setStats({
        total: data.length,
        critical: data.filter((t: any) => t.severity === 'critical').length,
        high: data.filter((t: any) => t.severity === 'high').length,
        medium: data.filter((t: any) => t.severity === 'medium').length,
        low: data.filter((t: any) => t.severity === 'low').length,
        byType
      });
    } catch (error) {
      console.error("Error fetching threats:", error);
    } finally {
      setIsLoading(false);
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
            Threat Detection
          </h1>
          <p className="text-muted-foreground">
            Comprehensive AI detection of ALL security threats, anomalies, and system issues
          </p>
        </div>

        {/* Threat Statistics */}
        {!isLoading && threats.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-primary">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Total Threats</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-threat-critical/10 to-threat-critical/5 border-threat-critical/20">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-threat-critical">{stats.critical}</div>
                <div className="text-xs text-muted-foreground">Critical</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-threat-high/10 to-threat-high/5 border-threat-high/20">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-threat-high">{stats.high}</div>
                <div className="text-xs text-muted-foreground">High</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-threat-medium/10 to-threat-medium/5 border-threat-medium/20">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-threat-medium">{stats.medium}</div>
                <div className="text-xs text-muted-foreground">Medium</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-threat-low/10 to-threat-low/5 border-threat-low/20">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-threat-low">{stats.low}</div>
                <div className="text-xs text-muted-foreground">Low</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Threat Types Summary */}
        {!isLoading && threats.length > 0 && Object.keys(stats.byType).length > 0 && (
          <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-sm">Threats by Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(stats.byType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm font-medium capitalize">{type.replace(/_/g, ' ')}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Detected Threats
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading threats...</div>
            ) : threats.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No threats detected yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severity</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Source IP</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Detected</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {threats.map((threat) => (
                      <TableRow key={threat.id} className="hover:bg-muted/30">
                        <TableCell>
                          <Badge className={getSeverityColor(threat.severity)}>
                            {threat.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{threat.threat_type}</TableCell>
                        <TableCell className="max-w-md truncate">{threat.description}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {threat.source_ip || "-"}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {threat.destination_ip || "-"}
                          {threat.port && `:${threat.port}`}
                        </TableCell>
                        <TableCell>
                          {threat.confidence_score ? `${threat.confidence_score}%` : "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(threat.detected_at), "MMM dd, HH:mm")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
