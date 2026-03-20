import { loadEnrichedSessions, filterSessions, formatTokens, formatDuration, getProjectName } from '../loader.js';

export async function sessions(options) {
  let sessions = loadEnrichedSessions();
  sessions = filterSessions(sessions, options);

  // Sort
  const sortFn = {
    tokens: (a, b) => ((b.input_tokens || 0) + (b.output_tokens || 0)) - ((a.input_tokens || 0) + (a.output_tokens || 0)),
    messages: (a, b) => (b.assistant_message_count || 0) - (a.assistant_message_count || 0),
    duration: (a, b) => (b.duration_minutes || 0) - (a.duration_minutes || 0),
    friction: (a, b) => {
      const aFric = Object.values(a.facet?.friction_counts || {}).reduce((s, v) => s + v, 0);
      const bFric = Object.values(b.facet?.friction_counts || {}).reduce((s, v) => s + v, 0);
      return bFric - aFric;
    },
  };

  sessions.sort(sortFn[options.sort] || sortFn.tokens);
  const limited = sessions.slice(0, options.limit);

  if (options.json) {
    console.log(JSON.stringify(limited, null, 2));
    return;
  }

  const label = options.days ? `last ${options.days} days` : 'all time';
  console.log(`\n  claude-analytics sessions (sorted by ${options.sort}, ${label})\n`);

  for (const s of limited) {
    const id = (s.session_id || '').slice(0, 8);
    const totalTokens = (s.input_tokens || 0) + (s.output_tokens || 0);
    const msgs = (s.user_message_count || 0) + (s.assistant_message_count || 0);
    const dur = formatDuration(s.duration_minutes || 0);
    const project = getProjectName(s.project_path);
    const friction = Object.values(s.facet?.friction_counts || {}).reduce((sum, v) => sum + v, 0);
    const outcome = s.facet?.outcome?.replace('_', ' ') || '';
    const label = s.facet?.brief_summary || (s.first_prompt || '').slice(0, 50) || 'no description';

    console.log(`  ${id}  ${formatTokens(totalTokens).padStart(7)} tok  ${String(msgs).padStart(4)} msgs  ${dur.padStart(6)}  ${String(friction).padStart(2)} fric  ${project.padEnd(18)}  ${label.slice(0, 45)}`);
  }

  console.log(`\n  Showing ${limited.length} of ${sessions.length} sessions\n`);
}
