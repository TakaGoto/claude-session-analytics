import { loadStatsCache, filterByDays, formatTokens, formatCost, PRICING } from '../loader.js';

export async function costs(options) {
  const stats = loadStatsCache();
  if (!stats?.dailyModelTokens) {
    console.log('No cost data found.');
    return;
  }

  let days = filterByDays(stats.dailyModelTokens, options.days);

  if (options.json) {
    console.log(JSON.stringify(days, null, 2));
    return;
  }

  const label = options.days ? `last ${options.days} days` : 'all time';
  console.log(`\n  claude-analytics costs (${label})\n`);

  // Aggregate by model
  const byModel = {};
  for (const day of days) {
    for (const [model, tokens] of Object.entries(day.tokensByModel || {})) {
      if (!byModel[model]) byModel[model] = 0;
      byModel[model] += tokens;
    }
  }

  let totalCost = 0;
  for (const [model, outputTokens] of Object.entries(byModel)) {
    const rates = PRICING[model] || PRICING['claude-opus-4-6'];
    // dailyModelTokens only tracks output tokens
    const cost = outputTokens / 1_000_000 * rates.output;
    totalCost += cost;
    const shortName = model.replace('claude-', '').replace(/-\d{8}$/, '');
    console.log(`  ${shortName.padEnd(22)} ${formatTokens(outputTokens).padStart(8)} output tokens  ${formatCost(cost).padStart(8)}`);
  }

  console.log(`\n  Estimated output cost: ${formatCost(totalCost)}`);
  console.log(`  (Note: this only reflects output tokens from daily logs. Full cost including input/cache is in 'summary')\n`);
}
