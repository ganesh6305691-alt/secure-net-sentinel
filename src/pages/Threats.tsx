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
            AI-detected security threats from analyzed logs
          </p>
        </div>

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
