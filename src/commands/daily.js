import { loadStatsCache, filterByDays } from '../loader.js';

export async function daily(options) {
  const stats = loadStatsCache();
  if (!stats?.dailyActivity) {
    console.log('No daily activity data found.');
    return;
  }

  let days = filterByDays(stats.dailyActivity, options.days);

  if (options.json) {
    console.log(JSON.stringify(days, null, 2));
    return;
  }

  const label = options.days ? `last ${options.days} days` : 'all time';
  console.log(`\n  claude-analytics daily (${label})\n`);
  console.log(`  ${'Date'.padEnd(12)} ${'Messages'.padStart(10)} ${'Sessions'.padStart(10)} ${'Tool Calls'.padStart(12)}  ${'Activity'}`);
  console.log(`  ${'─'.repeat(12)} ${'─'.repeat(10)} ${'─'.repeat(10)} ${'─'.repeat(12)}  ${'─'.repeat(20)}`);

  const maxMsgs = Math.max(...days.map(d => d.messageCount));

  for (const day of days) {
    const barLen = Math.round((day.messageCount / maxMsgs) * 20);
    const bar = '█'.repeat(barLen) + '░'.repeat(20 - barLen);
    console.log(`  ${day.date.padEnd(12)} ${day.messageCount.toLocaleString().padStart(10)} ${day.sessionCount.toLocaleString().padStart(10)} ${(day.toolCallCount || 0).toLocaleString().padStart(12)}  ${bar}`);
  }

  const totalMsgs = days.reduce((sum, d) => sum + d.messageCount, 0);
  const totalSessions = days.reduce((sum, d) => sum + d.sessionCount, 0);
  console.log(`\n  Total: ${totalMsgs.toLocaleString()} messages across ${totalSessions} sessions\n`);
}
