import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { loadEnrichedSessions, filterSessions, getProjectName, formatDuration, bar } from '../loader.js';

const PHASES = {
  planning: {
    label: 'Planning',
    toolSignals: ['EnterPlanMode', 'ExitPlanMode'],
    textSignals: ['plan', 'approach', 'architecture', 'design', 'strategy', 'proposal', 'should we', 'how should', 'what if we', 'options are', 'trade-off', 'tradeoff'],
  },
  implementing: {
    label: 'Implementing',
    toolSignals: ['Write', 'Edit', 'NotebookEdit'],
    textSignals: [],
  },
  fixing: {
    label: 'Fixing',
    toolSignals: [],
    textSignals: ['fix', 'bug', 'broken', 'error', 'failed', 'failing', 'crash', 'wrong', 'issue', 'doesnt work', "doesn't work", 'not working'],
  },
  researching: {
    label: 'Researching',
    toolSignals: ['WebSearch', 'WebFetch', 'Agent'],
    textSignals: ['research', 'look up', 'find out', 'search for', 'what is', 'how does'],
  },
  exploring: {
    label: 'Exploring code',
    toolSignals: ['Read', 'Grep', 'Glob'],
    textSignals: [],
  },
  running: {
    label: 'Running/Testing',
    toolSignals: ['Bash'],
    textSignals: ['test', 'run', 'build', 'deploy', 'install', 'start'],
  },
  questions: {
    label: 'Q&A',
    toolSignals: [],
    textSignals: [],
    isQuestion: true,
  },
};

function classifyMessage(data, prevPhase) {
  const type = data.type;

  // User messages
  if (type === 'user' && !data.isMeta) {
    const text = '';
    const msg = data.message;
    const userText = typeof msg === 'string' ? msg : (msg?.content || '');
    const lower = typeof userText === 'string' ? userText.toLowerCase() : '';

    // Check if it's a tool result (response to Claude's tool call)
    if (data.toolUseResult) return prevPhase || 'implementing';

    // Check for fixing signals in user text
    for (const signal of PHASES.fixing.textSignals) {
      if (lower.includes(signal)) return 'fixing';
    }

    // Check for planning signals
    for (const signal of PHASES.planning.textSignals) {
      if (lower.includes(signal)) return 'planning';
    }

    // Check for research signals
    for (const signal of PHASES.researching.textSignals) {
      if (lower.includes(signal)) return 'researching';
    }

    // Short messages ending with ? are questions
    if (lower.endsWith('?') || lower.length < 100 && (lower.includes('?') || lower.startsWith('how') || lower.startsWith('what') || lower.startsWith('why') || lower.startsWith('can you'))) {
      return 'questions';
    }

    // Default: probably giving implementation instructions
    return 'implementing';
  }

  // Assistant messages with tool calls
  if (type === 'assistant') {
    const content = data.message?.content || [];
    for (const block of content) {
      if (block?.type === 'tool_use') {
        const toolName = block.name || '';

        // Check each phase's tool signals (order matters: more specific first)
        if (PHASES.planning.toolSignals.includes(toolName)) return 'planning';
        if (PHASES.implementing.toolSignals.includes(toolName)) return 'implementing';
        if (PHASES.researching.toolSignals.includes(toolName)) return 'researching';
        if (PHASES.running.toolSignals.includes(toolName)) return 'running';
        if (PHASES.exploring.toolSignals.includes(toolName)) return 'exploring';
      }
    }

    // Assistant text-only response (no tools) = Q&A or explanation
    const hasToolUse = content.some(b => b?.type === 'tool_use');
    if (!hasToolUse) return 'questions';
  }

  // System messages after errors
  if (type === 'system') {
    if (data.error || data.level === 'error') return 'fixing';
  }

  return prevPhase || 'implementing';
}

function analyzeSession(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.trim().split('\n');

  const phases = {};
  for (const key of Object.keys(PHASES)) {
    phases[key] = { messages: 0, tokens: 0 };
  }

  let prevPhase = 'implementing';
  let firstTs = null;
  let lastTs = null;

  for (const line of lines) {
    let data;
    try {
      data = JSON.parse(line);
    } catch {
      continue;
    }

    if (data.timestamp) {
      if (!firstTs) firstTs = data.timestamp;
      lastTs = data.timestamp;
    }

    if (data.type !== 'user' && data.type !== 'assistant' && data.type !== 'system') continue;

    const phase = classifyMessage(data, prevPhase);
    prevPhase = phase;

    if (!phases[phase]) phases[phase] = { messages: 0, tokens: 0 };
    phases[phase].messages++;

    if (data.type === 'assistant') {
      const usage = data.message?.usage || {};
      phases[phase].tokens += (usage.input_tokens || 0) + (usage.output_tokens || 0);
    }
  }

  const totalMessages = Object.values(phases).reduce((s, p) => s + p.messages, 0);
  const totalTokens = Object.values(phases).reduce((s, p) => s + p.tokens, 0);
  const durationMs = firstTs && lastTs ? new Date(lastTs) - new Date(firstTs) : 0;

  return { phases, totalMessages, totalTokens, durationMs, firstTs, lastTs };
}

export async function breakdown(options) {
  const claudeDir = join(homedir(), '.claude');
  const projectsDir = join(claudeDir, 'projects');

  // Find the session to analyze
  let sessions = loadEnrichedSessions();
  sessions = filterSessions(sessions, options);

  if (sessions.length === 0) {
    console.log('No sessions found for the given filters.');
    return;
  }

  // Sort by most recent
  sessions.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
  const limited = sessions.slice(0, options.limit);

  if (options.json) {
    const results = [];
    for (const s of limited) {
      const jsonlPath = findJsonlPath(projectsDir, s.session_id);
      if (!jsonlPath) continue;
      const analysis = analyzeSession(jsonlPath);
      results.push({ session_id: s.session_id, project: getProjectName(s.project_path), ...analysis });
    }
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  const label = options.days ? `last ${options.days} days` : 'all time';
  console.log(`\n  claude-analytics breakdown (${label}, ${limited.length} sessions)\n`);

  // Aggregate across all matching sessions
  const aggregate = {};
  for (const key of Object.keys(PHASES)) {
    aggregate[key] = { messages: 0, tokens: 0 };
  }
  let totalDuration = 0;
  let analyzed = 0;

  for (const s of limited) {
    const jsonlPath = findJsonlPath(projectsDir, s.session_id);
    if (!jsonlPath) continue;

    const analysis = analyzeSession(jsonlPath);
    analyzed++;
    totalDuration += analysis.durationMs;

    for (const [phase, stats] of Object.entries(analysis.phases)) {
      if (!aggregate[phase]) aggregate[phase] = { messages: 0, tokens: 0 };
      aggregate[phase].messages += stats.messages;
      aggregate[phase].tokens += stats.tokens;
    }
  }

  if (analyzed === 0) {
    console.log('  Could not find session files to analyze.');
    return;
  }

  const totalMessages = Object.values(aggregate).reduce((s, p) => s + p.messages, 0);
  const totalTokens = Object.values(aggregate).reduce((s, p) => s + p.tokens, 0);

  console.log(`  Analyzed ${analyzed} sessions | ${formatDuration(Math.round(totalDuration / 60000))} total\n`);

  // Sort phases by message count
  const sorted = Object.entries(aggregate)
    .filter(([_, stats]) => stats.messages > 0)
    .sort((a, b) => b[1].messages - a[1].messages);

  const maxMsgs = sorted.length > 0 ? sorted[0][1].messages : 1;

  for (const [phase, stats] of sorted) {
    const pct = totalMessages > 0 ? Math.round(stats.messages / totalMessages * 100) : 0;
    const tokenPct = totalTokens > 0 ? Math.round(stats.tokens / totalTokens * 100) : 0;
    const phaseLabel = PHASES[phase]?.label || phase;
    const estMinutes = totalDuration > 0 ? Math.round((stats.messages / totalMessages) * totalDuration / 60000) : 0;

    console.log(`  ${phaseLabel.padEnd(18)} ${bar(stats.messages, maxMsgs, 20)}  ${String(pct).padStart(3)}%  ~${formatDuration(estMinutes).padStart(6)}  ${String(stats.messages).padStart(5)} msgs  ${tokenPct}% tokens`);
  }

  // Codebase scanning stats
  const scanTools = ['Read', 'Grep', 'Glob'];
  let totalScans = 0;
  let scanTokens = 0;

  for (const s of limited) {
    const jsonlPath = findJsonlPath(projectsDir, s.session_id);
    if (!jsonlPath) continue;

    const content = readFileSync(jsonlPath, 'utf8');
    for (const line of content.trim().split('\n')) {
      try {
        const data = JSON.parse(line);
        if (data.type === 'assistant') {
          for (const block of data.message?.content || []) {
            if (block?.type === 'tool_use' && scanTools.includes(block.name)) {
              totalScans++;
            }
          }
          // Count tokens for exploring phase
          const usage = data.message?.usage || {};
          const msgTokens = (usage.input_tokens || 0) + (usage.output_tokens || 0);
          // Attribute tokens if this message had scan tools
          const hasScanTool = (data.message?.content || []).some(b => b?.type === 'tool_use' && scanTools.includes(b.name));
          if (hasScanTool) scanTokens += msgTokens;
        }
      } catch {}
    }
  }

  if (totalScans > 0) {
    const scanPct = totalTokens > 0 ? Math.round(scanTokens / totalTokens * 100) : 0;
    console.log(`\n  Codebase scanning:`);
    console.log(`    Total scans (Read/Grep/Glob): ${totalScans.toLocaleString()}`);
    console.log(`    Tokens spent scanning:        ${scanTokens.toLocaleString()} (${scanPct}% of total)`);
    if (totalScans > analyzed * 20) {
      console.log('    That\'s a lot of scanning. A detailed CLAUDE.md with file paths and');
      console.log('    architecture notes could help Claude find things without searching.');
    }
  }

  // Insights
  console.log('\n  Insights:');
  const fixingPct = totalMessages > 0 ? (aggregate.fixing?.messages || 0) / totalMessages * 100 : 0;
  const planningPct = totalMessages > 0 ? (aggregate.planning?.messages || 0) / totalMessages * 100 : 0;
  const exploringPct = totalMessages > 0 ? (aggregate.exploring?.messages || 0) / totalMessages * 100 : 0;
  const implementingPct = totalMessages > 0 ? (aggregate.implementing?.messages || 0) / totalMessages * 100 : 0;

  if (fixingPct > 25) {
    console.log(`    - ${Math.round(fixingPct)}% of your time is spent fixing things. Consider asking Claude`);
    console.log('      to write tests alongside new code, or use /plan before starting.');
  } else if (fixingPct > 15) {
    console.log(`    - ${Math.round(fixingPct)}% fixing is in the normal range, but watch for trends upward.`);
  } else if (fixingPct > 0) {
    console.log(`    - Only ${Math.round(fixingPct)}% fixing. That's solid.`);
  }

  if (planningPct < 5 && implementingPct > 50) {
    console.log('    - Very little planning relative to implementation. For complex tasks,');
    console.log('      spending more time in /plan mode can reduce fixing later.');
  }

  if (exploringPct > 30) {
    console.log(`    - ${Math.round(exploringPct)}% of time is exploring code. A stronger CLAUDE.md with`);
    console.log('      architecture notes could help Claude find things faster.');
  }

  console.log('');
}

function findJsonlPath(projectsDir, sessionId) {
  if (!existsSync(projectsDir)) return null;

  for (const project of readdirSync(projectsDir)) {
    const candidate = join(projectsDir, project, `${sessionId}.jsonl`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
