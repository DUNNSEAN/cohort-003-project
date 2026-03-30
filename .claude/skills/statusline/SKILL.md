---
name: statusline
description: Configures the Claude Code status line to show model name, context token count (colored by usage), a 20-char progress bar, and context percentage. Use when the user wants to set up, install, update, or change the Claude Code status line display.
---

# Statusline

Configures the Claude Code status line with:
- **Model name** (e.g. `Claude Sonnet 4.6`)
- **Token count** — back-calculated as `(used_pct / 100) * context_window_size`; colored green (<80k), yellow (80k–100k), red (≥100k)
- **Progress bar** — 20 chars wide using `█`/`░`; color thresholds derived from the same 80k/100k boundaries relative to the active model's context window size
- **Percentage** — raw `used_percentage` from the status line JSON

## Installation

Use the `statusline-setup` subagent to install or update. The subagent will:

1. Copy `scripts/statusline-command.sh` (bundled with this skill) to `~/.claude/statusline-command.sh`
2. Ensure `~/.claude/settings.json` has `statusline` pointing to `bash ~/.claude/statusline-command.sh`

**Prompt to send the subagent:**

> Install the statusline script from this skill. Copy the contents of `scripts/statusline-command.sh` (path: `/Users/dunni/Projects/cohort-003-project/.claude/skills/statusline/scripts/statusline-command.sh`) verbatim to `~/.claude/statusline-command.sh`, then ensure `~/.claude/settings.json` contains `"statusline": "bash /Users/dunni/.claude/statusline-command.sh"` under the top-level object.

## Customisation

To change thresholds or layout, update both:
- `scripts/statusline-command.sh` — the canonical source
- `~/.claude/statusline-command.sh` — the live copy

Key variables in the script:
| Variable | Default | Purpose |
|---|---|---|
| `80000` | 80k | Yellow threshold (tokens) |
| `100000` | 100k | Red threshold (tokens) |
| `20` | 20 | Progress bar width (chars) |

## How it works

The script receives a JSON blob on stdin from Claude Code. Relevant fields:

```json
{
  "model": { "display_name": "Claude Sonnet 4.6" },
  "context_window": {
    "used_percentage": 9.2,
    "context_window_size": 200000
  }
}
```

Token count is derived from `used_percentage` rather than `current_usage.*` because `current_usage` only reflects the last API call, not the full loaded context.
