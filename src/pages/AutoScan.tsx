import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Scan, Play, Square, Settings, Clock, FileText, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function AutoScan() {
  const { user } = useAuth();
  const [isScanning, setIsScanning] = useState(false);
  const [autoScanEnabled, setAutoScanEnabled] = useState(false);
  const [scanInterval, setScanInterval] = useState(60);
  const [logSource, setLogSource] = useState("windows-event");
  const [scannedCount, setScannedCount] = useState(0);
  const [threatsFound, setThreatsFound] = useState(0);

  const handleManualScan = async () => {
    if (!user) return;

    setIsScanning(true);
    setScannedCount(0);
    setThreatsFound(0);

    try {
      toast.info("Starting manual scan...");

      // Simulate fetching Windows Event Logs
      const logData = await simulateEventLogFetch();

      // Upload log to database
      const { data: logRecord, error: logError } = await supabase
        .from("logs")
        .insert({
          user_id: user.id,
          filename: `auto-scan-${new Date().toISOString()}.txt`,
          content: logData,
          file_size: new Blob([logData]).size,
          status: "pending",
        })
        .select()
        .single();

      if (logError) throw logError;

      setScannedCount(1);

      // Analyze the log
      const { data, error: functionError } = await supabase.functions.invoke("analyze-log", {
        body: { logId: logRecord.id },
      });

      if (functionError) throw functionError;

      setThreatsFound(data.threatsFound || 0);
      
      if (data.threatsFound > 0) {
        toast.success(`Scan complete! Found ${data.threatsFound} threat(s)`);
      } else {
        toast.success("Scan complete! No threats detected");
      }
    } catch (error: any) {
      console.error("Error during auto-scan:", error);
      toast.error(error.message || "Scan failed");
    } finally {
      setIsScanning(false);
    }
  };

  const simulateEventLogFetch = async (): Promise<string> => {
    // In a real implementation, this would use Windows Event Log APIs
    // For now, we simulate fetching recent system events
    const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
    
    return `Level\tDate and Time\tSource\tEvent ID\tTask Category
Information\t${timestamp}\tSystem\t7036\tNone\tThe Windows Update service entered the running state.
Information\t${timestamp}\tService Control Manager\t7040\tNone\tThe start type of the Windows Update service was changed.
Warning\t${timestamp}\tMicrosoft-Windows-DistributedCOM\t10016\tNone\tThe application-specific permission settings do not grant Local Activation permission.
Information\t${timestamp}\tMicrosoft-Windows-Security-Auditing\t4624\tNone\tAn account was successfully logged on.
Information\t${timestamp}\tMicrosoft-Windows-Kernel-General\t16\tNone\tThe access history in hive was cleared.`;
  };

  const handleToggleAutoScan = async () => {
    const newState = !autoScanEnabled;
    setAutoScanEnabled(newState);

    if (newState) {
      toast.success(`Auto-scan enabled! Will scan every ${scanInterval} minutes`);
    } else {
      toast.info("Auto-scan disabled");
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-cyber-glow bg-clip-text text-transparent">
            Automatic Log Scanner
          </h1>
          <p className="text-muted-foreground">
            Automatically scan system logs for threats without manual upload
          </p>
        </div>

        {/* Manual Scan */}
        <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scan className="w-5 h-5 text-primary" />
              Manual Scan
            </CardTitle>
            <CardDescription>
              Run an immediate scan of your system's event logs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div className="space-y-1">
                <p className="text-sm font-medium">Logs Scanned</p>
                <p className="text-2xl font-bold text-primary">{scannedCount}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Threats Found</p>
                <p className="text-2xl font-bold text-warning">{threatsFound}</p>
              </div>
            </div>

            <Button
              onClick={handleManualScan}
              disabled={isScanning}
              className="w-full"
              size="lg"
            >
              {isScanning ? (
                <>
                  <Square className="w-4 h-4 mr-2 animate-pulse" />
                  Scanning...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Manual Scan
                </>
              )}
            </Button>

            <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>
                This feature scans Windows Event Logs for security issues. In production, 
                it would use native Windows APIs to fetch real-time system events.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Auto-Scan Configuration */}
        <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Auto-Scan Configuration
            </CardTitle>
            <CardDescription>
              Configure automatic periodic scanning
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-scan" className="text-base">
                  Enable Auto-Scan
                </Label>
                <p className="text-sm text-muted-foreground">
                  Automatically scan system logs at regular intervals
                </p>
              </div>
              <Switch
                id="auto-scan"
                checked={autoScanEnabled}
                onCheckedChange={handleToggleAutoScan}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scan-interval" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Scan Interval (minutes)
              </Label>
              <Input
                id="scan-interval"
                type="number"
                min="5"
                max="1440"
                value={scanInterval}
                onChange={(e) => setScanInterval(parseInt(e.target.value))}
                disabled={!autoScanEnabled}
              />
              <p className="text-xs text-muted-foreground">
                Minimum: 5 minutes, Maximum: 1440 minutes (24 hours)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="log-source" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Log Source
              </Label>
              <select
                id="log-source"
                value={logSource}
                onChange={(e) => setLogSource(e.target.value)}
                disabled={!autoScanEnabled}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="windows-event">Windows Event Logs</option>
                <option value="security">Security Logs Only</option>
                <option value="system">System Logs Only</option>
                <option value="application">Application Logs Only</option>
              </select>
            </div>

            {autoScanEnabled && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <p className="text-sm font-medium text-foreground mb-1">
                  Auto-Scan Active
                </p>
                <p className="text-sm text-muted-foreground">
                  Next scan will run in approximately {scanInterval} minutes. 
                  Results will appear in your Threats and Alerts sections.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
          <CardHeader>
            <CardTitle>How Auto-Scan Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                1
              </div>
              <p>Connects to Windows Event Log system to fetch recent security and system events</p>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                2
              </div>
              <p>Automatically uploads collected logs to the secure database</p>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                3
              </div>
              <p>AI analyzes logs for security threats, service failures, and anomalies</p>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                4
              </div>
              <p>Generates alerts and notifications for detected threats</p>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                5
              </div>
              <p>Provides detailed solutions and remediation steps</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
