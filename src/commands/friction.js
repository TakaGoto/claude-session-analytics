import { loadEnrichedSessions, filterSessions, getProjectName } from '../loader.js';

export async function friction(options) {
  let sessions = loadEnrichedSessions();
  sessions = filterSessions(sessions, options);
  const withFacets = sessions.filter(s => s.facet);

  if (withFacets.length === 0) {
    console.log('No friction data found for the given filters.');
    return;
  }

  const label = options.days ? `last ${options.days} days` : 'all time';

  // Aggregate frictions
  const frictions = {};
  const frictionSessions = {};
  for (const s of withFacets) {
    for (const [f, count] of Object.entries(s.facet.friction_counts || {})) {
      frictions[f] = (frictions[f] || 0) + count;
      if (!frictionSessions[f]) frictionSessions[f] = [];
      frictionSessions[f].push(s);
    }
  }

  const sorted = Object.entries(frictions).sort((a, b) => b[1] - a[1]);

  if (options.json) {
    const result = sorted.map(([type, count]) => ({
      type,
      count,
      sessionsAffected: frictionSessions[type].length,
      projects: [...new Set(frictionSessions[type].map(s => getProjectName(s.project_path)))],
    }));
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`\n  claude-analytics friction (${label}, ${withFacets.length} sessions analyzed)\n`);

  if (sorted.length === 0) {
    console.log('  No friction recorded. Nice.\n');
    return;
  }

  const max = sorted[0][1];

  for (const [type, count] of sorted) {
    const label = type.replace(/_/g, ' ');
    const affected = frictionSessions[type].length;
    const projects = [...new Set(frictionSessions[type].map(s => getProjectName(s.project_path)))];
    const barLen = Math.round((count / max) * 15);
    const bar = '█'.repeat(barLen) + '░'.repeat(15 - barLen);

    console.log(`  ${label}`);
    console.log(`    ${bar}  ${count} occurrences across ${affected} sessions`);
    console.log(`    Projects: ${projects.slice(0, 5).join(', ')}`);
    console.log('');
  }

  // Actionable insights
  console.log('  Suggestions:');
  if (frictions['buggy_code'] > 5) {
    console.log('    - "buggy code" is your top friction. Consider adding test requirements to CLAUDE.md');
    console.log('      or asking Claude to write tests before implementation.');
  }
  if (frictions['wrong_approach'] > 3) {
    console.log('    - "wrong approach" is common. Try using /plan before complex tasks so Claude');
    console.log('      aligns on the approach before writing code.');
  }
  if (frictions['misunderstood_request'] > 2) {
    console.log('    - "misunderstood request" keeps happening. Be more specific in your prompts,');
    console.log('      or add project context to CLAUDE.md so Claude understands your codebase better.');
  }
  if (frictions['user_rejected_action'] > 3) {
    console.log('    - Lots of rejected actions. Review your permission settings or add clearer');
    console.log('      constraints in CLAUDE.md about what Claude should and shouldn\'t do.');
  }

  console.log('');
}
