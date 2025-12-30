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

    // Extract user from JWT token for ownership verification
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized - No token provided' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (!user || authError) {
      return new Response(JSON.stringify({ error: 'Unauthorized - Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify log ownership
    const { data: log, error: logError } = await supabase
      .from("logs")
      .select("*")
      .eq("id", logId)
      .eq("user_id", user.id) // Security: Verify user owns this log
      .single();

    if (logError || !log) {
      console.error("Log access denied or not found:", logError);
      return new Response(JSON.stringify({ error: 'Log not found or access denied' }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("logs").update({ status: "processing" }).eq("id", logId);

    // Sanitize and limit log content for AI processing
    const MAX_CONTENT_LENGTH = 50000;
    const sanitizedContent = log.content
      .slice(0, MAX_CONTENT_LENGTH)
      .replace(/\b(ignore|forget|disregard|bypass|override)\s+(previous|all|these)\s+(instructions?|rules?|prompts?)/gi, '[FILTERED]');

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
            content: `You are a cybersecurity AI analyzing Windows Event Logs and network security logs. Focus on detecting real security threats and system issues.

**Windows Event Log Format:**
Columns: Level, Date and Time, Source, Event ID, Task Category, Description

**Common Security Threats to Detect:**
1. **Service Failures (Error level)**: Service crashes, especially security services (Event IDs: 7034, 7031, 7000)
2. **Permission Issues (Warning level)**: DCOM permission errors, unauthorized access attempts (Event ID: 10016)
3. **Failed Login Attempts**: Multiple failed authentication attempts (Event ID: 4625)
4. **Unusual Network Activity**: Excessive connection attempts, port scanning
5. **System Crashes**: Blue screens, kernel errors (Event IDs: 41, 1001)
6. **Privilege Escalation**: Attempts to gain admin rights (Event ID: 4672)
7. **Malware Indicators**: Suspicious process creation, registry modifications

**Analysis Instructions:**
- IGNORE routine informational events like "Roam Complete" (Event 7003, 7021) unless excessive
- FOCUS on Error and Warning level events
- Identify patterns: repeated failures, permission issues, service crashes
- For each threat, provide specific Event ID, timestamp, and affected component

Return JSON array:
[{"type":"service_failure|permission_denied|failed_auth|malware|suspicious_activity|system_crash|network_anomaly","severity":"critical|high|medium|low|info","description":"Specific description with Event ID and component","source":"Event source name","event_id":"Event ID number","timestamp":"Date and time","recommendation":"Specific fix or action","confidence":85}]

Return empty array [] if no security threats detected.`,
          },
          { role: "user", content: `Analyze this Windows Event Log for security threats and system issues:\n\n${sanitizedContent}` },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ 
          error: "Rate limited - too many requests. Please wait a moment.",
          retryAfter: 5,
          isRateLimited: true 
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ 
          error: "AI credits exhausted. Please add credits to continue.",
          isPaymentRequired: true 
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    
    // Strip markdown code fences if present (AI sometimes wraps JSON in ```json ... ```)
    let content = aiData.choices[0].message.content || "[]";
    if (content.trim().startsWith('```')) {
      content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }
    
    const threats = JSON.parse(content);

    console.log(`AI detected ${threats.length} threats for log ${logId}`);

    for (const threat of threats) {
      const { data: threatData } = await supabase
        .from("threats")
        .insert({
          log_id: logId,
          threat_type: threat.type || "suspicious",
          severity: threat.severity || "medium",
          description: threat.description || "Threat detected",
          source_ip: threat.source || null,
          destination_ip: threat.event_id || null,
          port: threat.event_id ? parseInt(threat.event_id) : null,
          confidence_score: threat.confidence || 75,
        })
        .select()
        .single();

      if (threatData) {
        await supabase.from("alerts").insert({
          user_id: log.user_id,
          threat_id: threatData.id,
          title: `${threat.severity?.toUpperCase() || 'MEDIUM'}: ${threat.type || 'Security Issue'}`,
          message: `${threat.description || 'Threat detected'}\n\nRecommendation: ${threat.recommendation || 'Review system logs and investigate'}`,
          severity: threat.severity || "medium",
        });
      }
    }

    await supabase.from("logs").update({ 
      status: "analyzed", 
      analyzed_at: new Date().toISOString() 
    }).eq("id", logId);

    return new Response(JSON.stringify({ success: true, threatsFound: threats.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in analyze-log function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
