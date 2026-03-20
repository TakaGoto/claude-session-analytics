import { loadEnrichedSessions, filterSessions, formatTokens, formatDuration, getProjectName } from '../loader.js';

export async function efficiency(options) {
  let sessions = loadEnrichedSessions();
  sessions = filterSessions(sessions, options);

  if (sessions.length === 0) {
    console.log('No sessions found for the given filters.');
    return;
  }

  const label = options.days ? `last ${options.days} days` : 'all time';

  // Calculate per-session efficiency
  const scored = sessions
    .filter(s => (s.lines_added || 0) > 0)
    .map(s => {
      const totalTokens = (s.input_tokens || 0) + (s.output_tokens || 0);
      const lines = s.lines_added || 0;
      const tokensPerLine = lines > 0 ? Math.round(totalTokens / lines) : 0;
      const msgs = (s.user_message_count || 0) + (s.assistant_message_count || 0);
      const backAndForth = (s.user_message_count || 0) > 0
        ? ((s.assistant_message_count || 0) / (s.user_message_count || 1)).toFixed(1)
        : '0';
      return { ...s, totalTokens, tokensPerLine, backAndForth, msgs };
    });

  if (options.json) {
    console.log(JSON.stringify(scored.slice(0, options.limit), null, 2));
    return;
  }

  console.log(`\n  claude-analytics efficiency (${label})\n`);

  // Overall stats
  const totalTokens = scored.reduce((s, x) => s + x.totalTokens, 0);
  const totalLines = scored.reduce((s, x) => s + (x.lines_added || 0), 0);
  const avgTokensPerLine = totalLines > 0 ? Math.round(totalTokens / totalLines) : 0;
  const avgUserMsgs = scored.length > 0
    ? (scored.reduce((s, x) => s + (x.user_message_count || 0), 0) / scored.length).toFixed(1)
    : 0;

  console.log(`  Overall: ${formatTokens(totalTokens)} tokens → ${totalLines.toLocaleString()} lines of code`);
  console.log(`  Average: ${avgTokensPerLine} tokens per line | ${avgUserMsgs} prompts per session\n`);

  // Most efficient sessions (low tokens per line)
  const efficient = [...scored].sort((a, b) => a.tokensPerLine - b.tokensPerLine).slice(0, 5);
  console.log('  Most efficient sessions (lowest tokens per line):');
  for (const s of efficient) {
    const project = getProjectName(s.project_path);
    const id = (s.session_id || '').slice(0, 8);
    console.log(`    ${id}  ${String(s.tokensPerLine).padStart(5)} tok/line  ${String(s.lines_added).padStart(5)} lines  ${project.padEnd(20)}  ${(s.first_prompt || '').slice(0, 40)}`);
  }

  // Least efficient sessions (high tokens per line)
  const wasteful = [...scored].sort((a, b) => b.tokensPerLine - a.tokensPerLine).slice(0, 5);
  console.log('\n  Least efficient sessions (highest tokens per line):');
  for (const s of wasteful) {
    const project = getProjectName(s.project_path);
    const id = (s.session_id || '').slice(0, 8);
    console.log(`    ${id}  ${String(s.tokensPerLine).padStart(5)} tok/line  ${String(s.lines_added).padStart(5)} lines  ${project.padEnd(20)}  ${(s.first_prompt || '').slice(0, 40)}`);
  }

  // Sessions with most back-and-forth (high user message count relative to output)
  const chatty = [...scored]
    .filter(s => (s.user_message_count || 0) > 2)
    .sort((a, b) => (b.user_message_count || 0) - (a.user_message_count || 0))
    .slice(0, 5);

  if (chatty.length > 0) {
    console.log('\n  Most back-and-forth (many prompts to get the job done):');
    for (const s of chatty) {
      const project = getProjectName(s.project_path);
      const id = (s.session_id || '').slice(0, 8);
      console.log(`    ${id}  ${String(s.user_message_count).padStart(3)} prompts  ${String(s.lines_added).padStart(5)} lines  ${project.padEnd(20)}  ${(s.first_prompt || '').slice(0, 40)}`);
    }
  }

  console.log('\n  Tips:');
  if (avgTokensPerLine > 50) {
    console.log('    - Your tokens-per-line is high. Try being more specific in prompts');
    console.log('      and using /plan for complex tasks before jumping into code.');
  }
  if (parseFloat(avgUserMsgs) > 8) {
    console.log('    - High back-and-forth per session. Consider writing more detailed');
    console.log('      initial prompts or adding project context to CLAUDE.md.');
  }

  console.log('');
}
