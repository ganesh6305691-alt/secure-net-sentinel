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
            content: `You are an advanced cybersecurity AI specializing in Windows Event Log analysis and network security threat detection. Your mission is to identify ALL security threats, anomalies, and potential risks.

**Windows Event Log Format:**
Columns: Level, Date and Time, Source, Event ID, Task Category, Description

**COMPREHENSIVE THREAT CATEGORIES - Detect ALL of these:**

1. **SERVICE FAILURES (type: service_failure)**
   - Service crashes, unexpected terminations (Event IDs: 7034, 7031, 7000, 7001)
   - Security service failures (Windows Defender, Firewall, etc.)
   - Severity: Critical if security service, High otherwise

2. **PERMISSION VIOLATIONS (type: permission_denied)**
   - DCOM permission errors (Event ID: 10016)
   - Unauthorized access attempts
   - Access denied events
   - Severity: Medium to High

3. **AUTHENTICATION ANOMALIES (type: failed_auth)**
   - Failed login attempts (Event ID: 4625)
   - Multiple authentication failures from same source
   - Account lockouts (Event ID: 4740)
   - Severity: High if repeated, Medium otherwise

4. **SYSTEM CRASHES & INSTABILITY (type: system_crash)**
   - Blue screens, kernel errors (Event IDs: 41, 1001, 6008)
   - Unexpected shutdowns
   - Critical system errors
   - Severity: Critical

5. **MALWARE INDICATORS (type: malware)**
   - Suspicious process creation
   - Registry modifications in sensitive areas
   - Antivirus detections
   - Unknown service installations
   - Severity: Critical

6. **NETWORK ANOMALIES (type: network_anomaly)**
   - Excessive connection attempts
   - Port scanning behavior
   - Unusual network traffic patterns
   - Connection to suspicious IPs
   - Severity: High

7. **ANOMALOUS BEHAVIOR (type: anomaly)**
   - ANY unusual patterns or deviations from normal
   - Repeated errors or warnings
   - Timing anomalies (events clustered in short time)
   - Resource exhaustion indicators
   - Severity: Medium to High

8. **SUSPICIOUS ACTIVITY (type: suspicious)**
   - Any behavior that doesn't fit other categories but seems concerning
   - Unusual user activity
   - Privilege escalation attempts (Event ID: 4672)
   - Severity: Medium to High

**ANALYSIS RULES:**
✓ BE AGGRESSIVE: Better to flag potential issues than miss real threats
✓ DETECT PATTERNS: Look for repeated events, timing clusters, related events
✓ EVERY ERROR: All "Error" level events are potential threats
✓ WARNING CONTEXT: "Warning" events can indicate security issues
✓ IGNORE ONLY: Routine "Information" events with Event IDs 7003, 7021 (unless excessive)
✓ ANOMALY DETECTION: Flag anything unusual even if not clearly malicious

**OUTPUT FORMAT:**
Return JSON array with ALL detected threats:
[{
  "type": "service_failure|permission_denied|failed_auth|malware|suspicious|anomaly|system_crash|network_anomaly",
  "severity": "critical|high|medium|low",
  "description": "Detailed description including Event ID, Source, and specific issue",
  "source": "Event source name",
  "event_id": "Event ID number",
  "timestamp": "Date and time",
  "recommendation": "Specific remediation steps",
  "confidence": 70-100
}]

Return empty array [] ONLY if absolutely no threats detected.`,
          },
          { role: "user", content: `Analyze this Windows Event Log comprehensively. Detect ALL threats, anomalies, errors, and suspicious patterns:\n\n${sanitizedContent}` },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
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

    // Map AI threat types to database enum values
    const threatTypeMapping: Record<string, string> = {
      'service_failure': 'intrusion',
      'permission_denied': 'suspicious',
      'failed_auth': 'brute_force',
      'malware': 'malware',
      'network_anomaly': 'anomaly',
      'system_crash': 'intrusion',
      'anomaly': 'anomaly',
      'suspicious': 'suspicious',
      'suspicious_activity': 'suspicious',
      'intrusion': 'intrusion',
      'dos': 'dos',
      'brute_force': 'brute_force'
    };

    // Only process if there are actual threats detected
    if (threats.length > 0) {
      console.log(`Processing ${threats.length} threats for log ${logId}`);
      
      for (const threat of threats) {
        // Skip if this is marked as clean/safe
        if (threat.severity === 'info' && threat.description?.toLowerCase().includes('clean')) {
          console.log('Skipping clean log entry - no threat detected');
          continue;
        }
        
        // Map threat type or default to 'suspicious'
        const dbThreatType = threatTypeMapping[threat.type?.toLowerCase()] || 'suspicious';
        
        const { data: threatData } = await supabase
          .from("threats")
          .insert({
            log_id: logId,
            threat_type: dbThreatType,
            severity: threat.severity || "medium",
            description: threat.description || "Threat detected",
            source_ip: threat.source || null,
            destination_ip: threat.event_id || null,
            port: threat.event_id ? parseInt(threat.event_id) : null,
            confidence_score: threat.confidence || 75,
            raw_data: threat
          })
          .select()
          .single();

        // Create alert ONLY for actual threats (not clean logs)
        if (threatData) {
          const alertTitle = `${(threat.severity || 'medium').toUpperCase()} THREAT: ${threat.type || 'Security Issue'}`;
          const alertMessage = `${threat.description || 'Threat detected'}

Source: ${threat.source || 'Unknown'}
Event ID: ${threat.event_id || 'N/A'}
Time: ${threat.timestamp || 'Unknown'}

Recommendation: ${threat.recommendation || 'Review system logs and investigate immediately'}`;

          await supabase.from("alerts").insert({
            user_id: log.user_id,
            threat_id: threatData.id,
            title: alertTitle,
            message: alertMessage,
            severity: threat.severity || "medium",
          });
          
          console.log(`Created alert for threat ${threatData.id}: ${alertTitle}`);
        }
      }
    } else {
      console.log(`No threats detected for log ${logId} - log is clean`);
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
