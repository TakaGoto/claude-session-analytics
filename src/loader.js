import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CLAUDE_DIR = join(homedir(), '.claude');

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

// Merge session-meta with facets by session_id
export function loadEnrichedSessions() {
  const metas = loadSessionMeta();
  const facets = loadFacets();
  const facetMap = {};
  for (const f of facets) {
    facetMap[f.session_id] = f;
  }
  return metas.map(m => ({
    ...m,
    facet: facetMap[m.session_id] || null,
  }));
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

export function filterSessions(sessions, options) {
  let filtered = sessions;
  if (options.project) filtered = filterByProject(filtered, options.project);
  if (options.days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - options.days);
    filtered = filtered.filter(s => new Date(s.start_time) >= cutoff);
  }
  return filtered;
}

export function getProjectName(projectPath) {
  if (!projectPath) return 'unknown';
  return projectPath.split('/').filter(Boolean).pop();
}

export function formatTokens(n) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatPercent(n, total) {
  if (total === 0) return '0%';
  return `${Math.round(n / total * 100)}%`;
}

export function bar(value, max, width = 20) {
  const filled = max > 0 ? Math.round((value / max) * width) : 0;
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}
