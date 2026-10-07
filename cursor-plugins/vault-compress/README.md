# Vault Compress (Cursor plugin)

Periodically has the agent write a session diary entry to the vault via `/compress` (obsidian-vault skill).

## Installation

See [`AGENTS.md`](../../AGENTS.md), "Cursor plugins". In short: substitute `<vault-path>`, copy this folder to `~/.cursor/plugins/local/vault-compress/`, restart Cursor, and enable **vault-compress** under Settings → Plugins. Requires **bun** on `PATH`.

## How it works

On eligible `stop` events, the hook emits a `followup_message` that Cursor submits as the next prompt, asking the agent to run `obsidian-vault` + `/compress`. It writes only a diary file inside the vault — no git.

A turn counts only for `status: "completed"` with `loop_count: 0`, so follow-ups the hook itself triggered don't count.

Local state per workspace: `.cursor/hooks/state/vault-compress.json`.

## Trigger cadence (defaults)

| Mode | Min turns | Min minutes |
|------|-----------|-------------|
| Normal | 6 | 45 |
| Trial (`VAULT_COMPRESS_TRIAL_MODE=1`, first 24h) | 3 | 10 |

Both thresholds must be met (the first turn of a workspace starts the clock), and the transcript mtime must have advanced since the previous run.

## Env overrides

- `VAULT_DIR` — vault path, overrides the substituted default
- `VAULT_COMPRESS_MIN_TURNS`, `VAULT_COMPRESS_MIN_MINUTES`
- `VAULT_COMPRESS_TRIAL_MODE` (or `VAULT_COMPRESS_TRIAL`)
- `VAULT_COMPRESS_TRIAL_MIN_TURNS`, `VAULT_COMPRESS_TRIAL_MIN_MINUTES`, `VAULT_COMPRESS_TRIAL_DURATION_MINUTES`

## Related

- `/compress` command: [`commands/compress.md`](../../commands/compress.md)
- Claude Code equivalent: [`hooks/claude-code/vault-compress-stop.py.example`](../../hooks/claude-code/vault-compress-stop.py.example)
