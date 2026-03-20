# claude-session-analytics

CLI tool to analyze your Claude Code sessions. See where your tokens go, what tools get used, and how much it's costing you.

![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

## Why

Claude Code doesn't give you a clear picture of your usage. You hit rate limits and don't know why. You're burning tokens and don't know where. This tool reads your local session data and gives you answers.

## Install

```bash
npm install -g claude-session-analytics
```

Or run directly:

```bash
npx claude-session-analytics summary
```

## Commands

### `summary`

Overview of all usage: tokens, models, costs, top tools, busiest day.

```bash
claude-analytics summary
```

```
  Sessions: 250 | Messages: 149,122 | Since: 1/4/2026

  Tokens by model:
    opus-4-6                 2.1M in      1.7M out      2.1B cache read  $5124.21
    opus-4-5               623.5K in    390.3K out      2.0B cache read  $4471.94
    sonnet-4-5                860 in     14.0K out      3.7M cache read     $2.16

  Estimated total cost: $9598.32

  Top tools:
    Bash                 2,571
    Read                 1,989
    Edit                 1,048
```

### `costs`

Cost breakdown by model and time period.

```bash
claude-analytics costs
claude-analytics costs --days 30
```

### `sessions`

List sessions sorted by token usage, duration, or message count.

```bash
claude-analytics sessions --sort tokens --limit 5
claude-analytics sessions --sort duration --limit 10
claude-analytics sessions --project my-project
```

```
  a0d21fc2   185.9K tokens     28 msgs     10m  polymarket-bot  why isnt the bot watching the game
  d35e5157    82.1K tokens    187 msgs  13h 53m  punk_records    User asked Claude to build a...
  3a1be5b7    72.7K tokens     65 msgs      7m  cli             lets create something similar...
```

### `tools`

Tool usage frequency and patterns.

```bash
claude-analytics tools
claude-analytics tools --days 14
```

```
  Tool                      Total   Sessions  Avg/Session
  ────────────────────── ──────── ────────── ────────────
  Bash                      2,571        137           19
  Read                      1,989        152           13
  Edit                      1,048        105           10
```

### `daily`

Daily activity with a visual chart.

```bash
claude-analytics daily
claude-analytics daily --days 14
```

```
  Date           Messages   Sessions   Tool Calls  Activity
  2026-02-11       20,850         28        3,241  ████████████████████
  2026-02-12       10,362         17        1,922  ██████████░░░░░░░░░░
  2026-02-13        8,950         25        1,335  ████████░░░░░░░░░░░░
```

## Options

All commands support:

| Flag | Description |
|------|-------------|
| `--days <n>` | Filter to last N days |
| `--project <path>` | Filter to a specific project |
| `--sort <field>` | Sort by: tokens, messages, duration (sessions only) |
| `--limit <n>` | Number of results (default: 10) |
| `--json` | Output as JSON |
| `--help` | Show help |

## How it works

Claude Code stores session data locally in `~/.claude/`. This tool reads:

- **stats-cache.json**: aggregated daily activity and model token usage
- **usage-data/session-meta/**: per-session stats (duration, tools, tokens, files changed)
- **usage-data/facets/**: AI-generated session summaries and outcomes

No data leaves your machine. Everything is read-only and local.

## Cost estimates

Cost calculations use published Claude API pricing. These are estimates based on your local token counts. Actual billing may differ depending on your plan (Pro, Max, Team, Enterprise).

## Requirements

- Node.js 18+
- Claude Code installed (needs `~/.claude/` directory)

## License

MIT
