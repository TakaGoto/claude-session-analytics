import { loadEnrichedSessions, filterSessions, formatTokens, formatDuration, formatPercent, getProjectName } from '../loader.js';

export async function summary(options) {
  let sessions = loadEnrichedSessions();
  sessions = filterSessions(sessions, options);

  if (sessions.length === 0) {
    console.log('No sessions found for the given filters.');
    return;
  }

  const label = options.days ? `last ${options.days} day${options.days > 1 ? 's' : ''}` : 'all time';

  if (options.json) {
    console.log(JSON.stringify(buildStats(sessions), null, 2));
    return;
  }

  console.log(`\n  claude-analytics summary (${label})\n`);

  // Core stats
  const totalMessages = sessions.reduce((s, x) => s + (x.user_message_count || 0) + (x.assistant_message_count || 0), 0);
  const totalDuration = sessions.reduce((s, x) => s + (x.duration_minutes || 0), 0);
  console.log(`  Sessions: ${sessions.length} | Messages: ${totalMessages.toLocaleString()} | Time: ${formatDuration(totalDuration)}\n`);

  // Completion scorecard
  const withFacets = sessions.filter(s => s.facet);
  if (withFacets.length > 0) {
    const outcomes = {};
    for (const s of withFacets) {
      const o = s.facet.outcome || 'unknown';
      outcomes[o] = (outcomes[o] || 0) + 1;
    }
    const full = outcomes['fully_achieved'] || 0;
    const mostly = outcomes['mostly_achieved'] || 0;
    const partial = outcomes['partially_achieved'] || 0;
    const total = withFacets.length;

    console.log('  Completion:');
    console.log(`    Fully achieved:    ${String(full).padStart(4)}  ${formatPercent(full, total).padStart(4)}`);
    console.log(`    Mostly achieved:   ${String(mostly).padStart(4)}  ${formatPercent(mostly, total).padStart(4)}`);
    console.log(`    Partially:         ${String(partial).padStart(4)}  ${formatPercent(partial, total).padStart(4)}`);
  }

  // Efficiency
  const totalInput = sessions.reduce((s, x) => s + (x.input_tokens || 0), 0);
  const totalOutput = sessions.reduce((s, x) => s + (x.output_tokens || 0), 0);
  const totalLines = sessions.reduce((s, x) => s + (x.lines_added || 0), 0);
  const totalTokens = totalInput + totalOutput;
  const tokensPerLine = totalLines > 0 ? Math.round(totalTokens / totalLines) : 0;
  const totalCommits = sessions.reduce((s, x) => s + (x.git_commits || 0), 0);

  console.log('\n  Efficiency:');
  console.log(`    Tokens used:       ${formatTokens(totalTokens).padStart(8)}  (${formatTokens(totalInput)} in / ${formatTokens(totalOutput)} out)`);
  console.log(`    Lines of code:     ${totalLines.toLocaleString().padStart(8)}`);
  console.log(`    Tokens per line:   ${tokensPerLine.toLocaleString().padStart(8)}  ${tokensPerLine > 50 ? '(high — try more specific prompts)' : tokensPerLine > 20 ? '(normal)' : '(efficient)'}`);
  console.log(`    Git commits:       ${totalCommits.toLocaleString().padStart(8)}`);

  // Friction summary
  const allFrictions = {};
  for (const s of withFacets) {
    for (const [f, count] of Object.entries(s.facet.friction_counts || {})) {
      allFrictions[f] = (allFrictions[f] || 0) + count;
    }
  }
  const sortedFrictions = Object.entries(allFrictions).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (sortedFrictions.length > 0) {
    console.log('\n  Top friction points:');
    for (const [f, count] of sortedFrictions) {
      const label = f.replace(/_/g, ' ');
      console.log(`    ${label.padEnd(28)} ${count}`);
    }
  }

  // Bug fix ratio
  const goalCats = {};
  for (const s of withFacets) {
    for (const [cat, count] of Object.entries(s.facet.goal_categories || {})) {
      goalCats[cat] = (goalCats[cat] || 0) + count;
    }
  }
  const bugFixes = (goalCats['bug_fix'] || 0) + (goalCats['bug_fixing'] || 0);
  const features = goalCats['feature_implementation'] || 0;
  if (bugFixes > 0 || features > 0) {
    const totalWork = bugFixes + features;
    console.log('\n  Time split:');
    console.log(`    Bug fixes:         ${String(bugFixes).padStart(4)}  ${formatPercent(bugFixes, totalWork).padStart(4)}`);
    console.log(`    New features:      ${String(features).padStart(4)}  ${formatPercent(features, totalWork).padStart(4)}`);
  }

  // Interruption rate
  const totalInterruptions = sessions.reduce((s, x) => s + (x.user_interruptions || 0), 0);
  const totalToolErrors = sessions.reduce((s, x) => s + (x.tool_errors || 0), 0);
  console.log('\n  Signals:');
  console.log(`    User interruptions:  ${totalInterruptions.toLocaleString().padStart(6)}  ${totalInterruptions > sessions.length ? '(high — Claude may be going off track often)' : '(normal)'}`);
  console.log(`    Tool errors:         ${totalToolErrors.toLocaleString().padStart(6)}`);

  console.log('');
}

function buildStats(sessions) {
  const withFacets = sessions.filter(s => s.facet);
  const outcomes = {};
  const frictions = {};
  for (const s of withFacets) {
    const o = s.facet.outcome || 'unknown';
    outcomes[o] = (outcomes[o] || 0) + 1;
    for (const [f, c] of Object.entries(s.facet.friction_counts || {})) {
      frictions[f] = (frictions[f] || 0) + c;
    }
  }
  return {
    sessionCount: sessions.length,
    totalMessages: sessions.reduce((s, x) => s + (x.user_message_count || 0) + (x.assistant_message_count || 0), 0),
    totalInputTokens: sessions.reduce((s, x) => s + (x.input_tokens || 0), 0),
    totalOutputTokens: sessions.reduce((s, x) => s + (x.output_tokens || 0), 0),
    totalDurationMinutes: sessions.reduce((s, x) => s + (x.duration_minutes || 0), 0),
    linesAdded: sessions.reduce((s, x) => s + (x.lines_added || 0), 0),
    linesRemoved: sessions.reduce((s, x) => s + (x.lines_removed || 0), 0),
    gitCommits: sessions.reduce((s, x) => s + (x.git_commits || 0), 0),
    outcomes,
    frictions,
    userInterruptions: sessions.reduce((s, x) => s + (x.user_interruptions || 0), 0),
    toolErrors: sessions.reduce((s, x) => s + (x.tool_errors || 0), 0),
  };
}
