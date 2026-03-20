# claude-session-analytics

CLI tool that helps you understand and improve how you work with Claude Code. Find out what's slowing you down, which projects need attention, and whether your workflow is getting better over time.

![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

## Why

Claude Code's `/insights` gives you a nice report, but it doesn't answer the questions that actually matter:

- Am I spending too many tokens on simple tasks?
- Which projects have the most friction?
- Is "buggy code" my biggest problem, or is it "wrong approach"?
- Am I getting better at working with Claude over time?
- Where am I wasting the most back-and-forth?

This tool reads your local Claude Code session data and gives you actionable answers.

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

Your development scorecard: completion rate, friction points, efficiency, and bug fix ratio.

```
$ claude-analytics summary

  Sessions: 188 | Messages: 15,191 | Time: 298h 22m

  Completion:
    Fully achieved:      10   20%
    Mostly achieved:     27   54%
    Partially:           13   26%

  Efficiency:
    Tokens used:           2.1M  (755.0K in / 1.3M out)
    Lines of code:       57,613
    Tokens per line:         36  (normal)

  Top friction points:
    buggy code                   25
    wrong approach               17
    user rejected action         9

  Time split:
    Bug fixes:           22   65%
    New features:        12   35%
```

### `friction`

What's slowing you down, which projects are affected, and what to do about it.

```
$ claude-analytics friction

  buggy code
    ███████████████  25 occurrences across 14 sessions
    Projects: bandai-events, terror, punk_records

  wrong approach
    ██████████░░░░░  17 occurrences across 13 sessions
    Projects: bandai-events, punk_records, terror

  Suggestions:
    - "buggy code" is your top friction. Consider adding test requirements
      to CLAUDE.md or asking Claude to write tests before implementation.
    - "wrong approach" is common. Try using /plan before complex tasks.
```

### `efficiency`

Token efficiency: most and least efficient sessions, and where you're burning tokens.

```
$ claude-analytics efficiency

  Overall: 2.0M tokens → 57,613 lines of code
  Average: 34 tokens per line | 7.1 prompts per session

  Most efficient sessions (lowest tokens per line):
    52887a00      0 tok/line    211 lines  optcg-sim

  Least efficient sessions (highest tokens per line):
    a0d21fc2   4225 tok/line     44 lines  polymarket-bot

  Most back-and-forth (many prompts to get the job done):
    d1a959c5   55 prompts    676 lines  punk_records
```

### `projects`

Per-project health: tokens, friction, bugs, and completion rates.

```
$ claude-analytics projects

  punk_records
    ███████████████  50 sessions | 101h | 535K tokens
    Lines: 16,656 | Tok/line: 32 | Bugs: 2 | Friction: 19 | Completion: 33%

  Watch list:
    punk_records: 19 friction points — review CLAUDE.md or simplify tasks
```

### `trends`

Weekly trends so you can see if things are getting better or worse.

```
$ claude-analytics trends

  Week         Sessions    Lines  Tok/Line  Friction  Complete Activity
  2026-02-22         17   11,367        28        28       18% ████░░░░░░
  2026-03-01         17    8,355        38        18       14% ████░░░░░░

  Trend analysis:
    Friction is increasing (9.5 vs 7.7 avg/week). Check what's causing it.
    Token efficiency is improving (27 vs 49 tokens/line).
```

### `sessions`

List individual sessions. Sort by tokens, messages, duration, or friction.

```
$ claude-analytics sessions --sort friction --limit 5
```

### `tools`

Tool usage frequency and patterns across sessions.

```
$ claude-analytics tools
```

## Options

All commands support:

| Flag | Description |
|------|-------------|
| `--days <n>` | Filter to last N days |
| `--project <path>` | Filter to a specific project |
| `--sort <field>` | Sort by: tokens, messages, duration, friction |
| `--limit <n>` | Number of results (default: 10) |
| `--json` | Output as JSON |

## How it works

Claude Code stores session data locally in `~/.claude/`. This tool reads:

- **usage-data/session-meta/**: per-session stats (duration, tools, tokens, lines changed, errors)
- **usage-data/facets/**: AI-generated session analysis (outcomes, friction types, goals)
- **stats-cache.json**: aggregated daily activity and model usage

No data leaves your machine. Everything is read-only and local.

## Requirements

- Node.js 18+
- Claude Code installed (needs `~/.claude/` directory)

## License

MIT
