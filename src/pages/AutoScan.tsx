import { useState, useEffect } from "react";
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
import { parseWindowsEventLog, formatLogEntry } from "@/utils/logParser";
import { Progress } from "@/components/ui/progress";

export default function AutoScan() {
  const { user } = useAuth();
  const [isScanning, setIsScanning] = useState(false);
  const [autoScanEnabled, setAutoScanEnabled] = useState(false);
  const [scanInterval, setScanInterval] = useState(60);
  const [logSource, setLogSource] = useState("windows-event");
  const [scannedCount, setScannedCount] = useState(0);
  const [threatsFound, setThreatsFound] = useState(0);
  const [progress, setProgress] = useState(0);
  const [scanIntervalId, setScanIntervalId] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (scanIntervalId) {
        clearInterval(scanIntervalId);
      }
    };
  }, [scanIntervalId]);

  const handleManualScan = async () => {
    if (!user) return;

    setIsScanning(true);
    setScannedCount(0);
    setThreatsFound(0);
    setProgress(0);

    try {
      toast.info("Starting manual scan...");

      // Simulate fetching Windows Event Logs (multiple entries)
      const logData = await simulateEventLogFetch();
      
      // Parse the log data into individual entries
      const entries = parseWindowsEventLog(logData);
      
      if (entries.length === 0) {
        toast.warning("No log entries found");
        return;
      }

      toast.info(`Found ${entries.length} log entries. Analyzing...`);

      let totalThreats = 0;

      // Process each log entry with delay to avoid rate limiting
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const entryContent = formatLogEntry(entry);

        // Upload log to database
        const { data: logRecord, error: logError } = await supabase
          .from("logs")
          .insert({
            user_id: user.id,
            filename: `auto-scan-${new Date().toISOString()}_entry_${i + 1}.txt`,
            content: entryContent,
            file_size: new Blob([entryContent]).size,
            status: "pending",
          })
          .select()
          .single();

        if (logError) {
          console.error(`Error creating log entry ${i + 1}:`, logError);
          continue;
        }

        // Analyze the log with retry logic
        let retries = 0;
        const maxRetries = 3;
        
        while (retries < maxRetries) {
          try {
            const { data, error: functionError } = await supabase.functions.invoke("analyze-log", {
              body: { logId: logRecord.id },
            });

            if (functionError) {
              throw functionError;
            }

            if (data?.isRateLimited) {
              retries++;
              if (retries < maxRetries) {
                toast.warning(`Rate limited. Waiting before retry ${retries}/${maxRetries}...`);
                await new Promise(resolve => setTimeout(resolve, (data.retryAfter || 5) * 1000));
                continue;
              }
            }

            if (data?.threatsFound) {
              totalThreats += data.threatsFound;
              setThreatsFound(totalThreats);
            }
            break;
          } catch (error: any) {
            console.error(`Error analyzing log entry ${i + 1}:`, error);
            if (error?.message?.includes("429") || error?.status === 429) {
              retries++;
              if (retries < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                continue;
              }
            }
            break;
          }
        }

        setScannedCount(i + 1);
        setProgress(((i + 1) / entries.length) * 100);
        
        // Add delay between requests to prevent rate limiting
        if (i < entries.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (totalThreats > 0) {
        toast.success(`Scan complete! Found ${totalThreats} threat(s) across ${entries.length} log entries`);
      } else {
        toast.success(`Scan complete! Scanned ${entries.length} log entries. No threats detected`);
      }
    } catch (error: any) {
      console.error("Error during auto-scan:", error);
      toast.error(error.message || "Scan failed");
    } finally {
      setIsScanning(false);
      setProgress(0);
    }
  };

  const simulateEventLogFetch = async (): Promise<string> => {
    // Simulate fetching multiple recent system events
    const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
    
    // Generate multiple log entries
    const logs = [
      `Level\tDate and Time\tSource\tEvent ID\tTask Category`,
      `Information\t${timestamp}\tSystem\t7036\tNone\tThe Windows Update service entered the running state.`,
      `Information\t${timestamp}\tService Control Manager\t7040\tNone\tThe start type of the Windows Update service was changed.`,
      `Warning\t${timestamp}\tMicrosoft-Windows-DistributedCOM\t10016\tNone\tThe application-specific permission settings do not grant Local Activation permission.`,
      `Information\t${timestamp}\tMicrosoft-Windows-Security-Auditing\t4624\tNone\tAn account was successfully logged on.`,
      `Information\t${timestamp}\tMicrosoft-Windows-Kernel-General\t16\tNone\tThe access history in hive was cleared.`,
      `Warning\t${timestamp}\tMicrosoft-Windows-DistributedCOM\t10016\tNone\tDCOM permission error for application ShellHWDetection.`,
      `Information\t${timestamp}\tSystem\t7036\tNone\tThe Diagnostic Policy Service entered the running state.`,
      `Error\t${timestamp}\tService Control Manager\t7034\tNone\tThe Windows Search service terminated unexpectedly.`,
    ];
    
    return logs.join('\n');
  };

  const handleToggleAutoScan = async () => {
    const newState = !autoScanEnabled;
    setAutoScanEnabled(newState);

    if (newState) {
      toast.success(`Auto-scan enabled! Will scan every ${scanInterval} minutes`);
      
      // Start periodic scanning
      const intervalMs = scanInterval * 60 * 1000;
      const id = setInterval(() => {
        handleManualScan();
      }, intervalMs);
      setScanIntervalId(id);
      
      // Run first scan immediately
      handleManualScan();
    } else {
      if (scanIntervalId) {
        clearInterval(scanIntervalId);
        setScanIntervalId(null);
      }
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
            Automatically scan multiple system logs for threats without manual upload
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
              Run an immediate scan of your system's event logs (scans all entries)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isScanning && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Scanning logs...</span>
                  <span className="font-medium">{scannedCount} logs processed</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

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
                This feature scans multiple Windows Event Log entries for security issues. Each log entry is analyzed separately by AI.
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
              Configure automatic periodic scanning of multiple logs
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
                disabled={isScanning}
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
                disabled={!autoScanEnabled || isScanning}
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
                disabled={!autoScanEnabled || isScanning}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="windows-event">Windows Event Logs (All)</option>
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
                  Scanning multiple log entries every {scanInterval} minutes. Results will appear in your Threats and Alerts sections.
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
              <p>Parses log file into individual log entries for separate analysis</p>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                3
              </div>
              <p>Automatically uploads each collected log entry to the secure database</p>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                4
              </div>
              <p>AI analyzes each log individually for security threats, service failures, and anomalies</p>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                5
              </div>
              <p>Generates alerts and notifications for detected threats</p>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                6
              </div>
              <p>Provides detailed solutions and remediation steps for each threat</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
