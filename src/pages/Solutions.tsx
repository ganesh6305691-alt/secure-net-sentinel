import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Lightbulb, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface ThreatWithSolution {
  id: string;
  threat_type: string;
  severity: string;
  description: string;
  detected_at: string;
  recommendation: string;
}

export default function Solutions() {
  const { user, isAdmin } = useAuth();
  const [threats, setThreats] = useState<ThreatWithSolution[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchThreatsWithSolutions();
  }, [user, isAdmin]);

  const fetchThreatsWithSolutions = async () => {
    try {
      let query = supabase.from("threats").select(`
        *,
        logs!inner(user_id)
      `);

      if (!isAdmin) {
        query = query.eq("logs.user_id", user!.id);
      }

      const { data, error } = await query.order("detected_at", { ascending: false }).limit(50);

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

  const getSolutionForThreat = (threatType: string) => {
    const solutions: Record<string, any> = {
      intrusion: {
        title: "System Intrusion / Service Failure Detected",
        steps: [
          "Open Services (services.msc) as Administrator",
          "Locate the failed service and check its status",
          "Review Event Viewer for detailed error messages",
          "Try restarting the service manually",
          "Check service dependencies and ensure they're running",
          "Verify service account permissions",
          "If persistent, reinstall or repair the application"
        ],
        prevention: "Enable service recovery options to automatically restart failed services",
        links: ["https://docs.microsoft.com/en-us/windows/win32/services/services"]
      },
      suspicious: {
        title: "Suspicious Activity Detected",
        steps: [
          "Review the specific event details in Event Viewer",
          "Check for unauthorized access attempts",
          "Verify all user accounts are legitimate",
          "Scan system with Windows Defender",
          "Review recent system changes and installations",
          "Check Task Manager for unknown processes",
          "Monitor system behavior for additional anomalies"
        ],
        prevention: "Enable audit logging, use strong passwords, keep software updated",
        links: ["https://docs.microsoft.com/en-us/windows/security/"]
      },
      anomaly: {
        title: "System Anomaly Detected",
        steps: [
          "Identify the pattern causing the anomaly",
          "Check system resource usage (CPU, Memory, Disk)",
          "Review Event Viewer for related events",
          "Scan for malware and rootkits",
          "Update all drivers and system software",
          "Monitor the issue over time to establish baseline",
          "If persistent, consider system restore or clean install"
        ],
        prevention: "Regular system monitoring, baseline establishment, automated alerts",
        links: ["https://docs.microsoft.com/en-us/windows/security/threat-protection/"]
      },
      service_failure: {
        title: "Service Failure Detected",
        steps: [
          "Open Services (services.msc) as Administrator",
          "Locate the failed service and check its status",
          "Review Event Viewer for detailed error messages",
          "Try restarting the service manually",
          "Check service dependencies and ensure they're running",
          "Verify service account permissions",
          "If persistent, reinstall or repair the application"
        ],
        prevention: "Enable service recovery options to automatically restart failed services",
        links: ["https://docs.microsoft.com/en-us/windows/win32/services/services"]
      },
      permission_denied: {
        title: "Permission/DCOM Error",
        steps: [
          "Press Win+R, type 'dcomcnfg' and press Enter",
          "Navigate to Component Services → Computers → My Computer → DCOM Config",
          "Find the CLSID mentioned in the error",
          "Right-click → Properties → Security tab",
          "Adjust Launch and Activation Permissions",
          "Add the affected user account with Local Activation permission",
          "Apply changes and restart the system"
        ],
        prevention: "Regularly review DCOM permissions during software installations",
        links: ["https://docs.microsoft.com/en-us/windows/win32/com/dcom-security-enhancements"]
      },
      brute_force: {
        title: "Brute Force / Failed Authentication Attempts",
        steps: [
          "Review Event ID 4625 in Security Event Log",
          "Identify the source IP and username",
          "Check if it's a legitimate user with wrong password",
          "If external: Block the IP in Windows Firewall",
          "Enable Account Lockout Policy (max 3-5 attempts)",
          "Implement strong password policies",
          "Consider enabling two-factor authentication"
        ],
        prevention: "Use strong passwords, enable MFA, monitor login attempts",
        links: ["https://docs.microsoft.com/en-us/windows/security/threat-protection/security-policy-settings/account-lockout-policy"]
      },
      malware: {
        title: "Potential Malware Activity",
        steps: [
          "Disconnect from network immediately",
          "Run Windows Defender full scan",
          "Use additional malware scanner (Malwarebytes, etc.)",
          "Review startup programs (Task Manager → Startup)",
          "Check Task Scheduler for suspicious tasks",
          "Scan all downloaded files and email attachments",
          "If infected: Consider clean Windows reinstall"
        ],
        prevention: "Keep Windows Defender updated, avoid suspicious downloads",
        links: ["https://support.microsoft.com/en-us/windows/stay-protected-with-windows-security"]
      },
      dos: {
        title: "Denial of Service / Resource Exhaustion",
        steps: [
          "Identify the source of excessive requests",
          "Block offending IPs in Windows Firewall",
          "Check for misconfigured applications causing loops",
          "Monitor network bandwidth usage",
          "Use Resource Monitor to identify resource-intensive processes",
          "Enable connection limiting in services",
          "Consider using rate limiting or DDoS protection"
        ],
        prevention: "Implement rate limiting, use firewalls, monitor traffic patterns",
        links: ["https://docs.microsoft.com/en-us/windows/security/threat-protection/windows-firewall/"]
      },
      network_anomaly: {
        title: "Network Anomaly Detected",
        steps: [
          "Open Resource Monitor → Network tab",
          "Identify processes with unusual network activity",
          "Check Windows Firewall logs",
          "Use Wireshark to capture and analyze packets",
          "Block suspicious IPs in firewall",
          "Update network drivers",
          "Scan for malware that may be causing traffic"
        ],
        prevention: "Monitor network traffic regularly, use intrusion detection",
        links: ["https://docs.microsoft.com/en-us/windows/security/threat-protection/windows-firewall/"]
      },
      system_crash: {
        title: "System Crash/Blue Screen",
        steps: [
          "Check Event ID 41 or 1001 for crash details",
          "Review minidump files in C:\\Windows\\Minidump",
          "Use BlueScreenView to analyze crash dumps",
          "Update all device drivers (especially GPU, chipset)",
          "Run Memory Diagnostic Tool (mdsched.exe)",
          "Check for Windows Updates",
          "Test hardware: RAM, hard drive, overheating"
        ],
        prevention: "Keep drivers updated, monitor system temperature, regular backups",
        links: ["https://docs.microsoft.com/en-us/windows-hardware/drivers/debugger/"]
      },
      default: {
        title: "Security Issue Detected",
        steps: [
          "Review the event details in Event Viewer",
          "Check Microsoft documentation for the Event ID",
          "Ensure Windows and all software is up to date",
          "Run Windows Security scan",
          "Check system file integrity: sfc /scannow",
          "Review recent system changes",
          "Consult with IT security team if needed"
        ],
        prevention: "Keep system updated, regular security scans, follow best practices",
        links: ["https://support.microsoft.com/"]
      }
    };

    return solutions[threatType] || solutions.default;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-cyber-glow bg-clip-text text-transparent">
            Security Solutions & Recommendations
          </h1>
          <p className="text-muted-foreground">
            Detailed remediation steps for detected threats and security issues
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading solutions...</div>
        ) : threats.length === 0 ? (
          <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-primary opacity-50" />
              <h3 className="text-xl font-semibold mb-2">No Active Threats</h3>
              <p className="text-muted-foreground">Your system is secure. Continue monitoring for new threats.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {threats.map((threat) => {
              const solution = getSolutionForThreat(threat.threat_type);
              return (
                <Card key={threat.id} className="bg-gradient-to-br from-card to-card/50 border-border/50">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge className={getSeverityColor(threat.severity)}>
                            {threat.severity}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(threat.detected_at), "MMM dd, yyyy HH:mm")}
                          </span>
                        </div>
                        <CardTitle className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-5 h-5 text-warning" />
                          {solution.title}
                        </CardTitle>
                        <CardDescription className="text-base">
                          {threat.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Solution Steps */}
                    <div>
                      <h4 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-primary" />
                        Resolution Steps:
                      </h4>
                      <ol className="space-y-2">
                        {solution.steps.map((step: string, idx: number) => (
                          <li key={idx} className="flex gap-3 text-sm text-muted-foreground">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                              {idx + 1}
                            </span>
                            <span className="pt-0.5">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Prevention */}
                    <div className="bg-muted/30 rounded-lg p-4">
                      <h4 className="font-semibold text-sm text-foreground mb-2">
                        Prevention:
                      </h4>
                      <p className="text-sm text-muted-foreground">{solution.prevention}</p>
                    </div>

                    {/* Resources */}
                    <div className="flex flex-wrap gap-2">
                      {solution.links.map((link: string, idx: number) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          asChild
                          className="gap-2"
                        >
                          <a href={link} target="_blank" rel="noopener noreferrer">
                            Learn More
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
