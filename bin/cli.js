#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { summary } from '../src/commands/summary.js';
import { costs } from '../src/commands/costs.js';
import { sessions } from '../src/commands/sessions.js';
import { tools } from '../src/commands/tools.js';
import { daily } from '../src/commands/daily.js';

const HELP = `
claude-analytics — Analyze your Claude Code sessions

Usage:
  claude-analytics <command> [options]

Commands:
  summary             Overview of all usage (tokens, sessions, models)
  costs               Estimated cost breakdown by model and time period
  sessions            List sessions sorted by tokens, duration, or messages
  tools               Tool usage frequency and patterns
  daily               Daily activity breakdown

Options:
  --days <n>          Filter to last N days (default: all)
  --project <path>    Filter to a specific project path
  --sort <field>      Sort by: tokens, messages, duration (sessions command)
  --limit <n>         Number of results to show (default: 10)
  --json              Output as JSON
  --help              Show this help message

Examples:
  claude-analytics summary
  claude-analytics costs --days 30
  claude-analytics sessions --sort tokens --limit 5
  claude-analytics tools --project /Users/me/my-project
  claude-analytics daily --days 14
`;

const command = process.argv[2];

if (!command || command === '--help' || command === '-h') {
  console.log(HELP);
  process.exit(0);
}

const { values: flags } = parseArgs({
  args: process.argv.slice(3),
  options: {
    days: { type: 'string' },
    project: { type: 'string' },
    sort: { type: 'string', default: 'tokens' },
    limit: { type: 'string', default: '10' },
    json: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
  allowPositionals: true,
});

const options = {
  days: flags.days ? parseInt(flags.days) : null,
  project: flags.project || null,
  sort: flags.sort || 'tokens',
  limit: parseInt(flags.limit) || 10,
  json: flags.json || false,
};

const commands = { summary, costs, sessions, tools, daily };

if (!commands[command]) {
  console.error(`Unknown command: ${command}\n`);
  console.log(HELP);
  process.exit(1);
}

try {
  await commands[command](options);
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
