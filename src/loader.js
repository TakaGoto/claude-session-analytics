import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CLAUDE_DIR = join(homedir(), '.claude');

// Pricing per 1M tokens (as of March 2026)
export const PRICING = {
  'claude-opus-4-6': { input: 15, output: 75, cacheRead: 1.5, cacheCreate: 18.75 },
  'claude-opus-4-5-20251101': { input: 15, output: 75, cacheRead: 1.5, cacheCreate: 18.75 },
  'claude-sonnet-4-5-20250929': { input: 3, output: 15, cacheRead: 0.3, cacheCreate: 3.75 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4, cacheRead: 0.08, cacheCreate: 1 },
};

export function getClaudeDir() {
  if (!existsSync(CLAUDE_DIR)) {
    throw new Error(`Claude directory not found at ${CLAUDE_DIR}. Is Claude Code installed?`);
  }
  return CLAUDE_DIR;
}

export function loadStatsCache() {
  const path = join(getClaudeDir(), 'stats-cache.json');
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function loadSessionMeta() {
  const dir = join(getClaudeDir(), 'usage-data', 'session-meta');
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        return JSON.parse(readFileSync(join(dir, f), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function loadFacets() {
  const dir = join(getClaudeDir(), 'usage-data', 'facets');
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        return JSON.parse(readFileSync(join(dir, f), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function loadSessionsIndex() {
  const projectsDir = join(getClaudeDir(), 'projects');
  if (!existsSync(projectsDir)) return [];

  const allSessions = [];
  for (const project of readdirSync(projectsDir)) {
    const indexPath = join(projectsDir, project, 'sessions-index.json');
    if (existsSync(indexPath)) {
      try {
        const data = JSON.parse(readFileSync(indexPath, 'utf8'));
        for (const entry of data.entries || []) {
          allSessions.push({ ...entry, projectDir: project });
        }
      } catch {
        // skip corrupt files
      }
    }
  }
  return allSessions;
}

export function filterByDays(items, days, dateField = 'date') {
  if (!days) return items;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return items.filter(item => {
    const d = new Date(item[dateField]);
    return d >= cutoff;
  });
}

export function filterByProject(sessions, projectPath) {
  if (!projectPath) return sessions;
  return sessions.filter(s =>
    (s.project_path || s.projectPath || '').includes(projectPath)
  );
}

export function estimateCost(usage, model) {
  const rates = PRICING[model] || PRICING['claude-opus-4-6'];
  const m = 1_000_000;
  return (
    (usage.inputTokens || 0) / m * rates.input +
    (usage.outputTokens || 0) / m * rates.output +
    (usage.cacheReadInputTokens || 0) / m * rates.cacheRead +
    (usage.cacheCreationInputTokens || 0) / m * rates.cacheCreate
  );
}

export function formatTokens(n) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatCost(n) {
  return `$${n.toFixed(2)}`;
}

export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
