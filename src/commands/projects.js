import { loadEnrichedSessions, filterSessions, formatTokens, formatDuration, formatPercent, getProjectName, bar } from '../loader.js';

export async function projects(options) {
  let sessions = loadEnrichedSessions();
  sessions = filterSessions(sessions, options);

  if (sessions.length === 0) {
    console.log('No sessions found for the given filters.');
    return;
  }

  const label = options.days ? `last ${options.days} days` : 'all time';

  // Group by project
  const byProject = {};
  for (const s of sessions) {
    const name = getProjectName(s.project_path);
    if (!byProject[name]) byProject[name] = [];
    byProject[name].push(s);
  }

  // Calculate stats per project
  const projectStats = Object.entries(byProject).map(([name, sessions]) => {
    const withFacets = sessions.filter(s => s.facet);
    const frictionCount = withFacets.reduce((sum, s) => {
      return sum + Object.values(s.facet?.friction_counts || {}).reduce((a, b) => a + b, 0);
    }, 0);
    const bugFixes = withFacets.filter(s => {
      const cats = s.facet?.goal_categories || {};
      return cats['bug_fix'] || cats['bug_fixing'];
    }).length;
    const totalTokens = sessions.reduce((s, x) => s + (x.input_tokens || 0) + (x.output_tokens || 0), 0);
    const totalLines = sessions.reduce((s, x) => s + (x.lines_added || 0), 0);
    const fullAchieved = withFacets.filter(s => s.facet?.outcome === 'fully_achieved').length;

    return {
      name,
      sessions: sessions.length,
      totalTokens,
      totalLines,
      frictionCount,
      bugFixes,
      completionRate: withFacets.length > 0 ? fullAchieved / withFacets.length : null,
      facetCount: withFacets.length,
      totalDuration: sessions.reduce((s, x) => s + (x.duration_minutes || 0), 0),
      toolErrors: sessions.reduce((s, x) => s + (x.tool_errors || 0), 0),
    };
  });

  projectStats.sort((a, b) => b.sessions - a.sessions);
  const limited = projectStats.slice(0, options.limit);

  if (options.json) {
    console.log(JSON.stringify(limited, null, 2));
    return;
  }

  console.log(`\n  claude-analytics projects (${label}, ${Object.keys(byProject).length} projects)\n`);

  const maxSessions = Math.max(...limited.map(p => p.sessions));

  for (const p of limited) {
    const tokensPerLine = p.totalLines > 0 ? Math.round(p.totalTokens / p.totalLines) : 0;
    const completion = p.completionRate !== null ? formatPercent(p.completionRate * p.facetCount, p.facetCount) : 'n/a';

    console.log(`  ${p.name}`);
    console.log(`    ${bar(p.sessions, maxSessions, 15)}  ${p.sessions} sessions | ${formatDuration(p.totalDuration)} | ${formatTokens(p.totalTokens)} tokens`);
    console.log(`    Lines: ${p.totalLines.toLocaleString()} | Tok/line: ${tokensPerLine || 'n/a'} | Bugs: ${p.bugFixes} | Friction: ${p.frictionCount} | Completion: ${completion}`);
    console.log('');
  }

  // Flag projects with issues
  const highFriction = projectStats.filter(p => p.frictionCount > 3).sort((a, b) => b.frictionCount - a.frictionCount);
  const highBugs = projectStats.filter(p => p.bugFixes > 2).sort((a, b) => b.bugFixes - a.bugFixes);

  if (highFriction.length > 0 || highBugs.length > 0) {
    console.log('  Watch list:');
    for (const p of highFriction.slice(0, 3)) {
      console.log(`    ${p.name}: ${p.frictionCount} friction points — review CLAUDE.md or simplify tasks`);
    }
    for (const p of highBugs.slice(0, 3)) {
      console.log(`    ${p.name}: ${p.bugFixes} bug fix sessions — consider adding tests or stricter review`);
    }
    console.log('');
  }
}
