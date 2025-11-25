import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload as UploadIcon, FileText, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Upload() {
  const { user } = useAuth();
  const [logContent, setLogContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);

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

    setIsUploading(true);

    try {
      const { data: logData, error: logError } = await supabase
        .from("logs")
        .insert({
          user_id: user!.id,
          filename: fileName || "manual-input.txt",
          content: logContent,
          file_size: new Blob([logContent]).size,
          status: "pending",
        })
        .select()
        .single();

      if (logError) throw logError;

      toast.success("Log uploaded successfully! Analyzing...");

      const { error: functionError } = await supabase.functions.invoke("analyze-log", {
        body: { logId: logData.id },
      });

      if (functionError) throw functionError;

      setLogContent("");
      setFileName("");
      toast.success("Log analysis complete! Check your threats and alerts.");
    } catch (error: any) {
      console.error("Error uploading log:", error);
      toast.error(error.message || "Failed to upload log");
    } finally {
      setIsUploading(false);
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
            Upload network security logs for AI-powered threat analysis
          </p>
        </div>

        <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Log File Upload
            </CardTitle>
            <CardDescription>
              Supports CSV, TXT, JSON formats. Paste content or upload a file.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => document.getElementById("file-upload")?.click()}
                className="gap-2"
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
            />

            <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Sample Log Format:</p>
                <pre className="mt-1 text-xs overflow-x-auto">
                  {`2024-01-15 10:30:45 192.168.1.100 -> 192.168.1.200 port:22 SSH login attempt
2024-01-15 10:30:46 192.168.1.100 -> 192.168.1.200 port:22 Failed authentication
2024-01-15 10:30:47 192.168.1.100 -> 192.168.1.200 port:22 Failed authentication`}
                </pre>
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={isUploading || !logContent.trim()}
              className="w-full"
              size="lg"
            >
              {isUploading ? "Analyzing..." : "Upload & Analyze"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
