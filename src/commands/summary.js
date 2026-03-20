import { loadStatsCache, loadSessionMeta, formatTokens, formatCost, estimateCost, PRICING } from '../loader.js';

export async function summary(options) {
  const stats = loadStatsCache();
  const sessions = loadSessionMeta();

  if (!stats && sessions.length === 0) {
    console.log('No Claude Code usage data found.');
    return;
  }

  if (options.json) {
    console.log(JSON.stringify({ stats, sessionCount: sessions.length }, null, 2));
    return;
  }

  console.log('\n  claude-analytics summary\n');
  console.log(`  Sessions: ${stats?.totalSessions || sessions.length} | Messages: ${(stats?.totalMessages || 0).toLocaleString()} | Since: ${stats?.firstSessionDate ? new Date(stats.firstSessionDate).toLocaleDateString() : 'unknown'}\n`);

  // Model usage
  if (stats?.modelUsage) {
    console.log('  Tokens by model:');
    let totalCost = 0;
    for (const [model, usage] of Object.entries(stats.modelUsage)) {
      const shortName = model.replace('claude-', '').replace(/-\d{8}$/, '');
      const total = (usage.inputTokens || 0) + (usage.outputTokens || 0);
      const cost = estimateCost(usage, model);
      totalCost += cost;
      console.log(`    ${shortName.padEnd(20)} ${formatTokens(usage.inputTokens || 0).padStart(8)} in  ${formatTokens(usage.outputTokens || 0).padStart(8)} out  ${formatTokens(usage.cacheReadInputTokens || 0).padStart(8)} cache read  ${formatCost(cost).padStart(8)}`);
    }
    console.log(`\n  Estimated total cost: ${formatCost(totalCost)}`);
  }

  // Tool usage from session meta
  if (sessions.length > 0) {
    const toolTotals = {};
    for (const s of sessions) {
      for (const [tool, count] of Object.entries(s.tool_counts || {})) {
        toolTotals[tool] = (toolTotals[tool] || 0) + count;
      }
    }
    const sorted = Object.entries(toolTotals).sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (sorted.length > 0) {
      console.log('\n  Top tools:');
      for (const [tool, count] of sorted) {
        console.log(`    ${tool.padEnd(20)} ${count.toLocaleString()}`);
      }
    }
  }

  // Busiest day
  if (stats?.dailyActivity?.length > 0) {
    const busiest = stats.dailyActivity.reduce((max, day) =>
      day.messageCount > max.messageCount ? day : max
    );
    console.log(`\n  Busiest day: ${busiest.date} (${busiest.messageCount.toLocaleString()} messages, ${busiest.sessionCount} sessions)`);
  }

  // Longest session
  if (stats?.longestSession) {
    const ls = stats.longestSession;
    const hours = Math.round(ls.duration / 3600000);
    console.log(`  Longest session: ${ls.messageCount.toLocaleString()} messages over ${hours}h`);
  }

  console.log('');
}
