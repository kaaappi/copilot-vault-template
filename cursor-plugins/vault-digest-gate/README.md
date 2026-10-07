# Vault Digest Gate (Cursor plugin)

At session start, counts session-diary entries that are still undigested (no `digested:` in frontmatter) and, past a threshold, asks the agent to offer `/digest`.

Companion to **vault-compress** (captures sessions) and the `/digest` command (promotes them into nodes, with confirmation). This plugin only decides *when* to ask.

## Installation

See [`AGENTS.md`](../../AGENTS.md), "Cursor plugins". In short: substitute `<vault-path>`, copy this folder to `~/.cursor/plugins/local/vault-digest-gate/`, restart Cursor, and enable **vault-digest-gate** under Settings → Plugins. Requires **bun** on `PATH`.

## How it works

On `sessionStart`, the hook counts dated files (`YYYY-MM-DD-*.md`) under the vault's `session-diary/` (or `06-session-diary/`), excluding `_retrospectives/`. Past the threshold it emits `additional_context` asking the agent to offer `/digest`.

Local state per workspace: `.cursor/hooks/state/vault-digest-gate.json` (`lastNudgedCount`).

## Re-arm logic (count-based, not time-based)

The gate fires once the backlog crosses the threshold, then stays silent until the undigested count grows past the count at the last nudge. When `/digest` lowers the count, the baseline drops with it, so the next backlog triggers again.

## Env overrides

- `VAULT_DIR` — vault path, overrides the substituted default
- `VAULT_DIGEST_GATE_THRESHOLD` (default: `3`)

## Related

- `/digest` command: [`commands/digest.md`](../../commands/digest.md)
- Claude Code equivalent: [`hooks/claude-code/vault-digest-gate.sh.example`](../../hooks/claude-code/vault-digest-gate.sh.example)
