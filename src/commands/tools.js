import { loadSessionMeta, filterByProject } from '../loader.js';

export async function tools(options) {
  let metas = loadSessionMeta();
  metas = filterByProject(metas, options.project);

  if (options.days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - options.days);
    metas = metas.filter(s => new Date(s.start_time) >= cutoff);
  }

  const toolTotals = {};
  const toolBySessions = {};

  for (const s of metas) {
    for (const [tool, count] of Object.entries(s.tool_counts || {})) {
      toolTotals[tool] = (toolTotals[tool] || 0) + count;
      toolBySessions[tool] = (toolBySessions[tool] || 0) + 1;
    }
  }

  const sorted = Object.entries(toolTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, options.limit);

  if (options.json) {
    const result = sorted.map(([tool, count]) => ({
      tool,
      totalCalls: count,
      sessionsUsedIn: toolBySessions[tool],
      avgPerSession: Math.round(count / toolBySessions[tool]),
    }));
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const label = options.days ? `last ${options.days} days` : 'all time';
  console.log(`\n  claude-analytics tools (${label}, ${metas.length} sessions)\n`);
  console.log(`  ${'Tool'.padEnd(22)} ${'Total'.padStart(8)} ${'Sessions'.padStart(10)} ${'Avg/Session'.padStart(12)}`);
  console.log(`  ${'─'.repeat(22)} ${'─'.repeat(8)} ${'─'.repeat(10)} ${'─'.repeat(12)}`);

  for (const [tool, count] of sorted) {
    const sessCount = toolBySessions[tool];
    const avg = Math.round(count / sessCount);
    console.log(`  ${tool.padEnd(22)} ${count.toLocaleString().padStart(8)} ${sessCount.toLocaleString().padStart(10)} ${String(avg).padStart(12)}`);
  }

  console.log('');
}
