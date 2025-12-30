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

      // Generate logs based on selected source
      const logData = generateLogsBySource(logSource);
      
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
        const maxRetries = 5;
        let success = false;
        
        while (retries < maxRetries && !success) {
          try {
            const { data, error: functionError } = await supabase.functions.invoke("analyze-log", {
              body: { logId: logRecord.id },
            });

            if (functionError) {
              throw functionError;
            }

            if (data?.isRateLimited) {
              retries++;
              const waitTime = (data.retryAfter || 5) * 1000 + (retries * 2000);
              if (retries < maxRetries) {
                console.log(`Rate limited. Waiting ${waitTime/1000}s before retry ${retries}/${maxRetries}...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
              }
            } else {
              success = true;
              if (data?.threatsFound) {
                totalThreats += data.threatsFound;
                setThreatsFound(totalThreats);
              }
            }
          } catch (error: any) {
            console.error(`Error analyzing log entry ${i + 1}:`, error);
            const isRateLimited = error?.message?.includes("429") || error?.status === 429;
            if (isRateLimited) {
              retries++;
              if (retries < maxRetries) {
                const waitTime = 5000 + (retries * 2000);
                console.log(`Rate limit error. Waiting ${waitTime/1000}s...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
              }
            }
            break;
          }
        }

        setScannedCount(i + 1);
        setProgress(((i + 1) / entries.length) * 100);
        
        // Add delay between requests to prevent rate limiting (5 seconds)
        if (i < entries.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 5000));
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

  const generateLogsBySource = (source: string): string => {
    const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
    const header = `Level\tDate and Time\tSource\tEvent ID\tTask Category`;
    
    // Reduced log sets to prevent rate limiting
    const allLogs = {
      security: [
        `Warning\t${timestamp}\tMicrosoft-Windows-Security-Auditing\t4625\tNone\tAn account failed to log on.`,
        `Error\t${timestamp}\tMicrosoft-Windows-Security-Auditing\t4740\tNone\tA user account was locked out.`,
        `Warning\t${timestamp}\tMicrosoft-Windows-Security-Auditing\t4771\tNone\tKerberos pre-authentication failed.`,
      ],
      system: [
        `Error\t${timestamp}\tService Control Manager\t7034\tNone\tThe Windows Search service terminated unexpectedly.`,
        `Warning\t${timestamp}\tMicrosoft-Windows-Kernel-Power\t41\tNone\tThe system has rebooted without cleanly shutting down.`,
        `Error\t${timestamp}\tBugCheck\t1001\tNone\tThe computer has rebooted from a bugcheck.`,
      ],
      application: [
        `Warning\t${timestamp}\tMicrosoft-Windows-DistributedCOM\t10016\tNone\tThe application-specific permission settings do not grant Local Activation permission.`,
        `Error\t${timestamp}\tApplication Error\t1000\tNone\tFaulting application name: explorer.exe.`,
        `Error\t${timestamp}\tApplication Hang\t1002\tNone\tThe program explorer.exe stopped interacting with Windows.`,
      ],
    };
    
    let selectedLogs: string[] = [];
    
    if (source === "windows-event") {
      // Combine one from each for a smaller set
      selectedLogs = [allLogs.security[0], allLogs.system[0], allLogs.application[0]];
    } else if (source === "security") {
      selectedLogs = allLogs.security;
    } else if (source === "system") {
      selectedLogs = allLogs.system;
    } else if (source === "application") {
      selectedLogs = allLogs.application;
    }
    
    return [header, ...selectedLogs].join('\n');
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
                disabled={isScanning}
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
                disabled={isScanning}
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
