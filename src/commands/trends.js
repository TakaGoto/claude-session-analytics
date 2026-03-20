import { loadEnrichedSessions, filterSessions, formatTokens, formatPercent, bar } from '../loader.js';

export async function trends(options) {
  let sessions = loadEnrichedSessions();
  sessions = filterSessions(sessions, options);

  if (sessions.length === 0) {
    console.log('No sessions found for the given filters.');
    return;
  }

  const label = options.days ? `last ${options.days} days` : 'all time';

  // Group by week
  const byWeek = {};
  for (const s of sessions) {
    const date = new Date(s.start_time);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const key = weekStart.toISOString().slice(0, 10);
    if (!byWeek[key]) byWeek[key] = [];
    byWeek[key].push(s);
  }

  const weeks = Object.entries(byWeek)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, sessions]) => {
      const withFacets = sessions.filter(s => s.facet);
      const totalTokens = sessions.reduce((s, x) => s + (x.input_tokens || 0) + (x.output_tokens || 0), 0);
      const totalLines = sessions.reduce((s, x) => s + (x.lines_added || 0), 0);
      const tokensPerLine = totalLines > 0 ? Math.round(totalTokens / totalLines) : 0;
      const frictionCount = withFacets.reduce((sum, s) => {
        return sum + Object.values(s.facet?.friction_counts || {}).reduce((a, b) => a + b, 0);
      }, 0);
      const fullyAchieved = withFacets.filter(s => s.facet?.outcome === 'fully_achieved').length;
      const interruptions = sessions.reduce((s, x) => s + (x.user_interruptions || 0), 0);

      return {
        week,
        sessions: sessions.length,
        totalTokens,
        totalLines,
        tokensPerLine,
        frictionCount,
        completionRate: withFacets.length > 0 ? fullyAchieved / withFacets.length : null,
        facetCount: withFacets.length,
        interruptions,
      };
    });

  if (options.json) {
    console.log(JSON.stringify(weeks, null, 2));
    return;
  }

  console.log(`\n  claude-analytics trends (${label}, weekly)\n`);
  console.log(`  ${'Week'.padEnd(12)} ${'Sessions'.padStart(8)} ${'Lines'.padStart(8)} ${'Tok/Line'.padStart(9)} ${'Friction'.padStart(9)} ${'Complete'.padStart(9)} ${'Activity'}`);
  console.log(`  ${'─'.repeat(12)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(9)} ${'─'.repeat(9)} ${'─'.repeat(9)} ${'─'.repeat(15)}`);

  const maxSessions = Math.max(...weeks.map(w => w.sessions));

  for (const w of weeks) {
    const completion = w.completionRate !== null ? formatPercent(w.completionRate * w.facetCount, w.facetCount) : 'n/a';
    console.log(`  ${w.week.padEnd(12)} ${String(w.sessions).padStart(8)} ${w.totalLines.toLocaleString().padStart(8)} ${String(w.tokensPerLine || 'n/a').padStart(9)} ${String(w.frictionCount).padStart(9)} ${completion.padStart(9)} ${bar(w.sessions, maxSessions, 15)}`);
  }

  // Trend analysis
  if (weeks.length >= 3) {
    const recent = weeks.slice(-2);
    const earlier = weeks.slice(0, -2);

    const recentAvgFriction = recent.reduce((s, w) => s + w.frictionCount, 0) / recent.length;
    const earlierAvgFriction = earlier.reduce((s, w) => s + w.frictionCount, 0) / earlier.length;

    const recentAvgTokPerLine = recent.filter(w => w.tokensPerLine > 0).reduce((s, w) => s + w.tokensPerLine, 0) / (recent.filter(w => w.tokensPerLine > 0).length || 1);
    const earlierAvgTokPerLine = earlier.filter(w => w.tokensPerLine > 0).reduce((s, w) => s + w.tokensPerLine, 0) / (earlier.filter(w => w.tokensPerLine > 0).length || 1);

    console.log('\n  Trend analysis:');
    if (recentAvgFriction < earlierAvgFriction) {
      console.log(`    Friction is decreasing (${recentAvgFriction.toFixed(1)} vs ${earlierAvgFriction.toFixed(1)} avg/week). Nice.`);
    } else if (recentAvgFriction > earlierAvgFriction) {
      console.log(`    Friction is increasing (${recentAvgFriction.toFixed(1)} vs ${earlierAvgFriction.toFixed(1)} avg/week). Check what's causing it.`);
    }

    if (recentAvgTokPerLine < earlierAvgTokPerLine && earlierAvgTokPerLine > 0) {
      console.log(`    Token efficiency is improving (${Math.round(recentAvgTokPerLine)} vs ${Math.round(earlierAvgTokPerLine)} tokens/line).`);
    } else if (recentAvgTokPerLine > earlierAvgTokPerLine && earlierAvgTokPerLine > 0) {
      console.log(`    Token efficiency is declining (${Math.round(recentAvgTokPerLine)} vs ${Math.round(earlierAvgTokPerLine)} tokens/line).`);
    }
  }

  console.log('');
}
