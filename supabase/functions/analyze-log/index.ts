import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { logId } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: log, error: logError } = await supabase
      .from("logs")
      .select("*")
      .eq("id", logId)
      .single();

    if (logError) throw logError;

    await supabase.from("logs").update({ status: "processing" }).eq("id", logId);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a cybersecurity AI analyzing network logs. Identify threats and respond with JSON array:
[{"type":"dos|brute_force|malware|intrusion|suspicious|anomaly","severity":"critical|high|medium|low|info","description":"brief description","source_ip":"IP","dest_ip":"IP","port":number,"confidence":85}]
Return empty array if no threats detected.`,
          },
          { role: "user", content: `Analyze this log:\n${log.content}` },
        ],
      }),
    });

    const aiData = await aiResponse.json();
    const threats = JSON.parse(aiData.choices[0].message.content || "[]");

    for (const threat of threats) {
      const { data: threatData } = await supabase
        .from("threats")
        .insert({
          log_id: logId,
          threat_type: threat.type,
          severity: threat.severity,
          description: threat.description,
          source_ip: threat.source_ip,
          destination_ip: threat.dest_ip,
          port: threat.port,
          confidence_score: threat.confidence,
        })
        .select()
        .single();

      if (threatData) {
        await supabase.from("alerts").insert({
          user_id: log.user_id,
          threat_id: threatData.id,
          title: `${threat.severity.toUpperCase()}: ${threat.type}`,
          message: threat.description,
          severity: threat.severity,
        });
      }
    }

    await supabase.from("logs").update({ status: "analyzed", analyzed_at: new Date().toISOString() }).eq("id", logId);

    return new Response(JSON.stringify({ success: true, threatsFound: threats.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
