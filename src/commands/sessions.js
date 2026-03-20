import { loadSessionMeta, loadFacets, filterByProject, formatTokens, formatDuration, formatCost, PRICING } from '../loader.js';

export async function sessions(options) {
  let metas = loadSessionMeta();
  const facets = loadFacets();
  const facetMap = {};
  for (const f of facets) {
    facetMap[f.session_id] = f;
  }

  metas = filterByProject(metas, options.project);

  if (options.days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - options.days);
    metas = metas.filter(s => new Date(s.start_time) >= cutoff);
  }

  // Sort
  const sortFn = {
    tokens: (a, b) => ((b.input_tokens || 0) + (b.output_tokens || 0)) - ((a.input_tokens || 0) + (a.output_tokens || 0)),
    messages: (a, b) => (b.assistant_message_count || 0) - (a.assistant_message_count || 0),
    duration: (a, b) => (b.duration_minutes || 0) - (a.duration_minutes || 0),
  };

  metas.sort(sortFn[options.sort] || sortFn.tokens);
  const limited = metas.slice(0, options.limit);

  if (options.json) {
    console.log(JSON.stringify(limited, null, 2));
    return;
  }

  console.log(`\n  claude-analytics sessions (sorted by ${options.sort}, top ${options.limit})\n`);

  for (const s of limited) {
    const id = (s.session_id || '').slice(0, 8);
    const totalTokens = (s.input_tokens || 0) + (s.output_tokens || 0);
    const msgs = (s.user_message_count || 0) + (s.assistant_message_count || 0);
    const dur = formatDuration(s.duration_minutes || 0);
    const facet = facetMap[s.session_id];
    const label = facet?.brief_summary || s.first_prompt?.slice(0, 50) || 'no description';
    const project = (s.project_path || '').split('/').pop() || '';

    console.log(`  ${id}  ${formatTokens(totalTokens).padStart(7)} tokens  ${String(msgs).padStart(5)} msgs  ${dur.padStart(6)}  ${project.padEnd(20)}  ${label.slice(0, 50)}`);
  }

  console.log(`\n  Showing ${limited.length} of ${metas.length} sessions\n`);
}
