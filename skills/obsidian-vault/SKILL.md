---
name: obsidian-vault
description: >
  Personal knowledge base + vault management commands.
  Use BEFORE writing/modifying code, BEFORE PRs or messages, BEFORE refactoring,
  and whenever you need conventions, project context, or style.
  Commands: /compress (end of session), /catchup (start of session),
  /ingest (process raw sources), /lint-obsidian (audit vault health),
  /learn (fill knowledge gaps), /digest (meta-analysis),
  /vault-resolve-conflict (resolve git merge conflicts in the vault).
  Trigger when user says "check vault", "my patterns", "how do I usually",
  or references Obsidian/second brain. Trigger /compress proactively at session end.
  /compress and /digest can also be nudged automatically by hooks — see Automation Hooks below.
---

# Vault Lookup

The vault is a knowledge base with coding patterns, project context, communication style,
and AI skills. **Always check it before generating code or writing messages** — it contains
conventions that override defaults.

## MCP Tools

Two tools via `vault-search` MCP server:

### `search(query)` — Find relevant vault files
- Returns **top 3 results** ranked by semantic similarity (60%+ threshold)
- Works with keywords AND natural language
- English queries work best (summaries are in English)

### `get(path)` — Read a vault file
- Takes relative path from vault root
- Returns full file content

**MCP is read-only.** There's no `write`/`index` tool — creating or editing notes always happens by directly editing files (via the commands below, or ad hoc), the same way you'd edit any other file. The index picks up the change on the next reindex (git post-commit hook, or manually via `npm run index`).

## Lookup Flow

1. `search("your question or keywords")`
2. Pick the most relevant result from top 3
3. `get("path/from/search/result.md")`
4. Read the file, apply conventions to your task

Two calls: search → get.

## When to Search

| Trigger | Query example |
|---------|---------------|
| Before writing/modifying code | `search("component file structure conventions")` |
| Before creating a new file | `search("naming conventions files folders")` |
| Before writing a PR description | `search("PR description format")` |
| Before refactoring | `search("refactoring cycle phases")` |
| When unsure about scope | `search("scope discipline boundaries")` |
| Project-specific context | `search("<project-name> gotchas")` |

## Vault Commands

### `/compress` — End-of-session diary
**When**: End of any work session, or user says "compress", "write session".
**What**: Creates session diary with: log, corrections, new-things, Open Threads. Updates project CLAUDE.md.
**Trigger proactively**: When session is winding down.

### `/catchup` — Resume from last session
**When**: Start of session, or user says "continue", "what was I doing".
**What**: Reads last session diary, extracts Open Threads + project context.

### `/ingest` — Process raw source
**When**: User drops a file into `sources/`, or says "ingest", "process this".
**What**: Reads source → extracts concepts → creates/updates vault nodes. Source stays immutable.

### `/lint-obsidian` — Vault health audit
**When**: User asks "check vault", "lint", or periodically.
**What**: Scans curated node folders for orphans, missing cross-refs, stale nodes, missing pages, frontmatter gaps, contradictions and thin nodes (web-researches missing/thin ones, flags `[MISSING PAGE — unresourced]` instead of inventing content). Never touches `session-diary/` or `sources/`. Fixes on `vault-heal/YYYY-MM-DD` branch, commits there, does **not** merge — merging into the default branch is a human decision. Next session's `vault-git-sync-start.sh` hook (if enabled) will hop back to the default branch automatically once this branch's tree is clean, without touching or merging it.

### `/learn` — Knowledge gap filling
**When**: User says "find gaps", "what's missing", "research".
**What**: Finds gaps → researches externally → proposes nodes on `vault-learn/YYYY-MM-DD-topic` branch. Human approves. Same not-merged-automatically behavior as `/lint-obsidian` above.

### `/digest` — Meta-analysis (paired with `/compress`)
**When**: User says "digest", "what keeps going wrong", or the `vault-digest-gate` SessionStart hook flags enough undigested entries.
**What**: Analyzes unprocessed session diaries for recurring patterns and proposes new/expanded nodes with draft content. **Stops and waits for a per-proposal yes / edit / skip — writes nothing before that.** Only then writes the confirmed nodes and marks a diary `digested: YYYY-MM-DD` once all its proposals are resolved; deferred proposals leave the diary unmarked so it resurfaces next run.

### `/vault-resolve-conflict` — Resolve real git conflicts in the vault
**When**: A `git pull`/merge leaves conflict markers in vault files (rare in a single-user vault synced across your own devices).
**What**: Detects conflicted files, classifies each conflict (same-fact-different-wording / actual contradiction / additive), proposes a resolution per file. Actual contradictions are never silently picked — both sides are kept labeled for review. Always waits for per-file confirmation before applying; never commits or pushes.

## Automation Hooks

Two different kinds. **Nudge hooks** bring up `/compress` and `/digest` at the right moment — they suggest the command (one exception: the Cursor `vault-compress` plugin has the agent run `/compress`, see below). **Git sync hooks** actually pull/commit/push on their own, no confirmation — read that section before enabling them.

### Nudge hooks

**`/compress` nudge — Claude Code**: `Stop` hook, `~/.claude/hooks/vault-compress-stop.py`. Counts one turn per finished reply, per session, and fires once enough turns *and* enough minutes have both passed since the last nudge (defaults: 6 turns / 45 min, configurable via `VAULT_COMPRESS_MIN_TURNS` / `VAULT_COMPRESS_MIN_MINUTES`; `VAULT_COMPRESS_TRIAL_MODE=1` switches to 3 turns / 10 min for the first 24h). By default it asks you to *suggest* `/compress`; with `VAULT_COMPRESS_MODE=run` it asks you to run it. State: `~/.claude/hooks/state/vault-compress.json`. Template: [`hooks/claude-code/vault-compress-stop.py.example`](../../hooks/claude-code/vault-compress-stop.py.example).

**`/compress` nudge — Cursor**: a local Cursor plugin (`~/.cursor/plugins/local/vault-compress/`, source in [`cursor-plugins/vault-compress/`](../../cursor-plugins/vault-compress/)) with the same turn/time gate. Its stop hook sends a follow-up prompt, so here the agent **runs** `/compress` instead of offering it — the write is limited to the diary entry, the registries and the project `CLAUDE.md` Open Threads. State: `.cursor/hooks/state/vault-compress.json` in the workspace.

**`/digest` nudge — Claude Code**: `SessionStart` hook, `~/.claude/hooks/vault-digest-gate.sh`. Count-based, not time-based — fires once 3+ (configurable via `VAULT_DIGEST_GATE_THRESHOLD`) session-diary entries lack `digested:` in frontmatter, and re-arms only once that count grows past the last nudge. State: `~/.claude/hooks/state/vault-digest-gate.json`. Template: [`hooks/claude-code/vault-digest-gate.sh.example`](../../hooks/claude-code/vault-digest-gate.sh.example). Cursor: the `vault-digest-gate` plugin ([`cursor-plugins/vault-digest-gate/`](../../cursor-plugins/vault-digest-gate/)) does the same at `sessionStart`.

### Git sync hooks (pull/commit/push automatically)

Cover the case where the vault is only ever touched through an agent, not the Obsidian app — Obsidian Git's auto-commit/push timer only runs while Obsidian is open, so without these, nothing syncs a Claude-Code-only session's changes to the remote at all.

**Vault pull + branch hygiene — Claude Code**: `SessionStart` hook, `~/.claude/hooks/vault-git-sync-start.sh`. Fetches and fast-forwards the default branch (`main` by default, `VAULT_GIT_DEFAULT_BRANCH` to change). If the current branch is an unmerged `vault-heal/`/`vault-learn/` review branch *and* the tree is clean, switches back to the default branch for the session — the review branch itself is never touched or merged, that stays yours. Also surfaces (never deletes) review branches older than `VAULT_GIT_STALE_BRANCH_DAYS` (default 7) that still need review. Template: [`hooks/claude-code/vault-git-sync-start.sh.example`](../../hooks/claude-code/vault-git-sync-start.sh.example).

**Vault commit + push — Claude Code**: `Stop` hook, `~/.claude/hooks/vault-git-sync-stop.sh` (async). No-ops instantly if the tree is clean. Otherwise commits everything with a generic message and pushes the *current* branch (including a `vault-heal/`/`vault-learn/` branch, if that's what's checked out — pushing it is just a remote backup, still not a merge). If the push fails (usually a remote you haven't pulled), it wakes the model with a message pointing at `/vault-resolve-conflict` instead of silently losing work.

**Coexistence with Obsidian Git**: if you also use the Obsidian Git plugin (README step 3 — it has its own internal auto-commit/push timer, not a Claude Code hook), that plugin already owns sync *while Obsidian is open*. Two independent processes committing/pushing the same repo can race, so `vault-git-sync-stop.sh` best-effort checks for a running Obsidian process (`pgrep`, override the process name via `VAULT_GIT_OBSIDIAN_PROCESS_NAME`) and skips its own **push** if Obsidian looks alive — it still commits locally either way (that's always safe), it just leaves pushing to Obsidian Git in that case. If you never keep Obsidian open, this check is a no-op and the hook pushes normally.

**Note**: `VAULT_GIT_ROOT` (the outer git repo — e.g. the Obsidian vault root) and `VAULT_DIR` (the `Copilot-Vault/` notes folder, used by MCP and `vault-digest-gate.sh`) are usually different paths — `VAULT_DIR` is a subfolder of `VAULT_GIT_ROOT`. Don't conflate them when wiring the env vars.

### Wiring

Merge [`hooks/claude-code/settings.snippet.json`](../../hooks/claude-code/settings.snippet.json) into `~/.claude/settings.json`.

## Obsidian CLI

The `obsidian` CLI is available in terminal (requires Obsidian app running). Use it alongside MCP:

| Command | Use case |
|---------|----------|
| `obsidian search query="..."` | Full-text search (complements MCP semantic search) |
| `obsidian create name="Title"` | Create a new note |
| `obsidian append content="..."` | Append to a note |
| `obsidian unresolved` | Find broken wikilinks (useful for `/lint-obsidian`) |
| `obsidian orphans` | Find unlinked notes |
| `obsidian tags counts` | List all tags with frequency |

**Prefer CLI** for: creating/modifying notes, structural audits (orphans, broken links), tag stats.
**Prefer MCP** for: semantic "find similar" queries.

## Key Conventions (quick reference)

> Replace these with your own top conventions from the vault.

- Convention 1
- Convention 2
- Convention 3

## If MCP is Unavailable

Read files directly at the vault path. Start with `moc/Index.md`.
