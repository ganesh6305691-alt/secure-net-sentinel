import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload as UploadIcon, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { parseWindowsEventLog, formatLogEntry } from "@/utils/logParser";
import { Progress } from "@/components/ui/progress";

export default function Upload() {
  const { user } = useAuth();
  const [logContent, setLogContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalLogs, setTotalLogs] = useState(0);
  const [processedLogs, setProcessedLogs] = useState(0);
  const [threatsFound, setThreatsFound] = useState(0);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      setLogContent(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    if (!logContent.trim()) {
      toast.error("Please enter or upload log content");
      return;
    }

    const MAX_CONTENT_LENGTH = 100000;
    if (logContent.length > MAX_CONTENT_LENGTH) {
      toast.error(`Log content exceeds maximum size limit of ${MAX_CONTENT_LENGTH.toLocaleString()} characters`);
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setProcessedLogs(0);
    setThreatsFound(0);

    try {
      // Parse the log file into individual entries
      const entries = parseWindowsEventLog(logContent);
      
      if (entries.length === 0) {
        toast.error("No valid log entries found in the file");
        return;
      }

      setTotalLogs(entries.length);
      toast.info(`Found ${entries.length} log entries. Starting analysis...`);

      let totalThreats = 0;

      // Process each log entry
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const entryContent = formatLogEntry(entry);

        // Create log entry in database
        const { data: logData, error: logError } = await supabase
          .from("logs")
          .insert({
            user_id: user!.id,
            filename: `${fileName || 'manual-input'}_entry_${i + 1}.txt`,
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

        // Analyze the log entry
        try {
          const { data, error: functionError } = await supabase.functions.invoke("analyze-log", {
            body: { logId: logData.id },
          });

          if (!functionError && data?.threatsFound) {
            totalThreats += data.threatsFound;
            setThreatsFound(totalThreats);
          }
        } catch (error) {
          console.error(`Error analyzing log entry ${i + 1}:`, error);
        }

        setProcessedLogs(i + 1);
        setProgress(((i + 1) / entries.length) * 100);
      }

      setLogContent("");
      setFileName("");
      
      if (totalThreats > 0) {
        toast.success(`Analysis complete! Found ${totalThreats} threat(s) across ${entries.length} log entries. Check Threats and Alerts.`);
      } else {
        toast.success(`Analysis complete! Scanned ${entries.length} log entries. No threats detected.`);
      }
    } catch (error: any) {
      console.error("Error uploading logs:", error);
      toast.error(error.message || "Failed to upload logs");
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-cyber-glow bg-clip-text text-transparent">
            Upload Security Logs
          </h1>
          <p className="text-muted-foreground">
            Upload network security logs for AI-powered threat analysis. Each log entry will be analyzed separately.
          </p>
        </div>

        {/* Progress Card */}
        {isUploading && (
          <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Processing logs...</span>
                <span className="font-medium">{processedLogs} / {totalLogs}</span>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Threats Found: {threatsFound}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Log File Upload
            </CardTitle>
            <CardDescription>
              Supports Windows Event Logs, CSV, TXT, JSON formats. Each log entry will be analyzed individually.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => document.getElementById("file-upload")?.click()}
                className="gap-2"
                disabled={isUploading}
              >
                <UploadIcon className="w-4 h-4" />
                Choose File
              </Button>
              <input
                id="file-upload"
                type="file"
                accept=".txt,.csv,.json,.log"
                onChange={handleFileUpload}
                className="hidden"
              />
              {fileName && (
                <span className="text-sm text-muted-foreground">
                  Selected: {fileName}
                </span>
              )}
            </div>

            <Textarea
              placeholder="Or paste your log content here..."
              value={logContent}
              onChange={(e) => setLogContent(e.target.value)}
              rows={15}
              className="font-mono text-sm bg-muted/30"
              disabled={isUploading}
            />

            <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Windows Event Log Format:</p>
                <pre className="mt-1 text-xs overflow-x-auto">
                  {`Level\tDate and Time\tSource\tEvent ID\tTask Category
Information\t2024-01-15 10:30:45\tSystem\t7036\tNone
Warning\t2024-01-15 10:30:46\tDistributedCOM\t10016\tNone`}
                </pre>
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={isUploading || !logContent.trim()}
              className="w-full"
              size="lg"
            >
              {isUploading ? "Analyzing..." : "Upload & Analyze All Logs"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
