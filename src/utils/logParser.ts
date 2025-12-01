export interface ParsedLogEntry {
  level: string;
  timestamp: string;
  source: string;
  eventId: string;
  category: string;
  description?: string;
}

export function parseWindowsEventLog(content: string): ParsedLogEntry[] {
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) return [];
  
  // Skip header line if it starts with "Level"
  const startIndex = lines[0].toLowerCase().includes('level') ? 1 : 0;
  const entries: ParsedLogEntry[] = [];
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse tab-separated Windows Event Log format
    const parts = line.split('\t').map(p => p.trim());
    
    if (parts.length >= 5) {
      entries.push({
        level: parts[0] || 'Information',
        timestamp: parts[1] || new Date().toISOString(),
        source: parts[2] || 'Unknown',
        eventId: parts[3] || '0',
        category: parts[4] || 'None',
        description: parts[5] || ''
      });
    } else if (parts.length >= 3) {
      // Fallback for simpler log formats
      entries.push({
        level: 'Information',
        timestamp: parts[0] || new Date().toISOString(),
        source: parts[1] || 'Unknown',
        eventId: '0',
        category: 'None',
        description: parts[2] || ''
      });
    }
  }
  
  return entries;
}

export function formatLogEntry(entry: ParsedLogEntry): string {
  return `Level\tDate and Time\tSource\tEvent ID\tTask Category\n${entry.level}\t${entry.timestamp}\t${entry.source}\t${entry.eventId}\t${entry.category}${entry.description ? '\t' + entry.description : ''}`;
}

export function groupLogsByBatch(entries: ParsedLogEntry[], batchSize: number = 10): ParsedLogEntry[][] {
  const batches: ParsedLogEntry[][] = [];
  for (let i = 0; i < entries.length; i += batchSize) {
    batches.push(entries.slice(i, i + batchSize));
  }
  return batches;
}
