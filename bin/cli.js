#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { summary } from '../src/commands/summary.js';
import { friction } from '../src/commands/friction.js';
import { efficiency } from '../src/commands/efficiency.js';
import { projects } from '../src/commands/projects.js';
import { trends } from '../src/commands/trends.js';
import { sessions } from '../src/commands/sessions.js';
import { tools } from '../src/commands/tools.js';

const HELP = `
claude-analytics — Understand and improve how you work with Claude Code

Usage:
  claude-analytics <command> [options]

Commands:
  summary             Your development scorecard (completion rate, friction, efficiency)
  friction            What's slowing you down (bugs, wrong approaches, rejections)
  efficiency          Token efficiency — how much output per token spent
  projects            Per-project health and friction breakdown
  trends              Track how your workflow is improving over time
  sessions            List individual sessions with stats
  tools               Tool usage frequency and patterns

Options:
  --days <n>          Filter to last N days (default: all)
  --project <path>    Filter to a specific project path
  --sort <field>      Sort by: tokens, messages, duration, friction (sessions command)
  --limit <n>         Number of results to show (default: 10)
  --json              Output as JSON
  --help              Show this help message

Examples:
  claude-analytics summary
  claude-analytics friction --days 30
  claude-analytics efficiency --project my-app
  claude-analytics projects
  claude-analytics trends --days 60
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

const commands = { summary, friction, efficiency, projects, trends, sessions, tools };

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
