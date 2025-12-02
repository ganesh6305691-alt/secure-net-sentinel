export interface ParsedLogEntry {
  level: string;
  timestamp: string;
  source: string;
  eventId: string;
  category: string;
  description?: string;
}

export function parseWindowsEventLog(content: string): ParsedLogEntry[] {
  // Remove BOM character if present
  let cleanContent = content.replace(/^\ufeff/, '');
  
  const lines = cleanContent.split('\n');
  
  if (lines.length === 0) return [];
  
  // Find header line and detect format
  let headerIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i].toLowerCase();
    if (line.includes('level') && (line.includes('date') || line.includes('time'))) {
      headerIndex = i;
      break;
    }
  }
  
  // If no header found, try to parse as generic logs
  const startIndex = headerIndex >= 0 ? headerIndex + 1 : 0;
  const entries: ParsedLogEntry[] = [];
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse tab-separated Windows Event Log format
    const parts = line.split('\t').map(p => p.trim());
    
    // Windows Event Log format: Level, Date and Time, Source, Event ID, Task Category, [Description]
    if (parts.length >= 5) {
      entries.push({
        level: parts[0] || 'Information',
        timestamp: parts[1] || new Date().toISOString(),
        source: parts[2] || 'Unknown',
        eventId: parts[3] || '0',
        category: parts[4] || 'None',
        description: parts.slice(5).join(' ').trim() || ''
      });
    } 
    // Alternative formats with fewer columns
    else if (parts.length >= 3) {
      entries.push({
        level: 'Information',
        timestamp: parts[0] || new Date().toISOString(),
        source: parts[1] || 'Unknown',
        eventId: parts[2] || '0',
        category: 'None',
        description: parts.slice(3).join(' ').trim() || ''
      });
    }
    // Single line logs (comma or space separated)
    else if (line.length > 10 && !line.startsWith('#')) {
      entries.push({
        level: 'Information',
        timestamp: new Date().toISOString(),
        source: 'Unknown',
        eventId: '0',
        category: 'None',
        description: line
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
