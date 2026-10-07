# Copilot-Vault

An Obsidian-based knowledge base with semantic search (MCP), AI slash commands, and automated Git sync. Works with Claude Code and Cursor IDE.

**Setting this up with an AI agent?** Hand it this folder and let it follow [`AGENTS.md`](AGENTS.md): the same steps as the Setup section below, written so an agent can run them on its own and stop only where a human decision is needed (which vault to use, the API key, the git remote). If you're doing it by hand, follow the Setup section below. If a copy of this folder ships with vault content already in it, its `AGENTS.md` is tailored to that content — follow it instead, and don't run this README's step 1 (`mkdir`/`git init` a fresh vault) on top of existing notes.

## What's inside

```
copilot-vault-template/
├── AGENTS.md                            — agent-run install guide (same steps as Setup below)
├── vault-search-mcp/                    — MCP server (semantic search via Gemini embeddings)
│   ├── server.mjs                       — search() and get() tools over stdio
│   ├── index-vault.mjs                  — generates embedding vectors
│   ├── eval.example.mjs                 — search-quality smoke test (copy → eval.mjs, `npm run eval`)
│   ├── package.json
│   ├── mcp-config.example.json          — MCP connection config template
│   └── hooks/post-commit                — git hook for auto-reindexing
├── commands/                            — AI slash commands
│   ├── compress.md                      — /compress — end-of-session diary
│   ├── digest.md                        — /digest — meta-analysis (uses /compress output)
│   ├── catchup.md                       — /catchup — resume from last session
│   ├── ingest.md                        — /ingest — process raw source into vault
│   ├── lint-obsidian.md                 — /lint-obsidian — vault health audit
│   ├── learn.md                         — /learn — find and fill knowledge gaps
│   ├── vault-resolve-conflict.md        — /vault-resolve-conflict — resolve real git conflicts
│   ├── cursor-rule.example.mdc          — Cursor "always apply" rule template
│   └── obsidian-git.example.json        — Obsidian Git plugin settings
├── hooks/claude-code/                   — optional Claude Code hooks: nudges + git sync
│   ├── vault-compress-stop.py.example   — Stop hook: nudge /compress after enough turns and minutes
│   ├── vault-digest-gate.sh.example     — SessionStart hook: nudge /digest once diary backs up
│   ├── vault-git-sync-start.sh.example  — SessionStart hook: pull vault repo, fix stale branch
│   ├── vault-git-sync-stop.sh.example   — Stop hook: auto-commit + push vault changes
│   └── settings.snippet.json            — how to wire all four into ~/.claude/settings.json
├── cursor-plugins/                      — the same two nudges as local Cursor plugins (need bun)
│   ├── vault-compress/                  — stop hook: has the agent run /compress
│   └── vault-digest-gate/               — sessionStart hook: suggests /digest
└── skills/obsidian-vault/
    └── SKILL.md                         — AI skill file for vault lookup
```

## How it works

1. You write notes in Obsidian — interlinked Markdown with YAML frontmatter.
2. MCP server indexes your vault into embeddings so AI can search by meaning.
3. AI commands (`/compress`, `/ingest`, `/learn`, etc.) maintain and grow the vault.
4. Obsidian Git auto-commits and syncs every 10 minutes.
5. Git hook auto-reindexes after each commit — the server hot-reloads the index.

The AI checks the vault before writing code, before PRs, before creating files — and follows your conventions.

## Vault structure

The vault structure is flexible — create folders for your own topics. For the recommended architecture, see [Andrej Karpathy's LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — a three-layer pattern (raw sources → wiki → schema) that this system is based on.

Minimum required:
- **`moc/Index.md`** — main entry point. AI reads this first to navigate the vault.
- **`sources/`** — raw, immutable source files. Processed by `/ingest`, never modified after creation.
- **`session-diary/`** — session logs created by `/compress`, with `_retrospectives/` for corrections and new-things registries.
- **`CLAUDE.md`** at vault root — tells the AI what the vault is, what commands exist, and what conventions to follow.

Everything else — code patterns, project context, workflows, personas — is up to you.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+) — required for the MCP server
- [Obsidian](https://obsidian.md/) (v1.12+) — the note-taking app
- [Obsidian CLI](https://obsidian.md/cli) — official command-line interface for vault operations (search, read, create, append notes from terminal). Enable in Obsidian: Settings → General → Command line interface. AI agents use this for direct vault interaction.
- [Gemini API key](https://aistudio.google.com/apikey) — free tier works fine (for embeddings). Used as `GOOGLE_API_KEY`. Model: `gemini-embedding-2-preview` (set in `server.mjs` / `index-vault.mjs` / `eval.mjs` — change `MODEL` there to switch)
- Git + a remote repo for your vault — see step 1, "Set up the remote", for how to get one

## Setup

### 1. Create your vault

```bash
mkdir my-vault && cd my-vault && git init
mkdir -p moc sources session-diary/_retrospectives
```

Create `moc/Index.md` as the entry point. Create `CLAUDE.md` at root (see [step 7](#7-create-your-claudemd)). Add your own folders and notes.

**Set up the remote.** If an AI agent is running this setup, it must ask you which of these before doing anything — never guess a repo name or visibility, and never create or point at a remote silently:

- Already have an empty remote repo? `git remote add origin <url>`.
- Using GitHub with `gh` already authenticated (`gh auth status`)? Create one directly — confirm the name and `--private`/public choice with you first, then: `gh repo create <name> --private --source=. --remote=origin --push`.
- Not ready yet? Skip — everything up through local commands/skill setup still works without a remote. Just don't enable the git sync hooks (step 6) until one exists; they need `origin` to push to.

Keep it **private** unless you have a specific reason not to (see Security) — vault content usually includes project/work context you don't want public.

For structure inspiration, read the [Karpathy LLM Wiki gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — or just give it to an AI and ask it to set up the vault structure for you.

### 2. Enable Obsidian CLI

In Obsidian: Settings → General → **Command line interface** → Enable → follow the PATH registration prompt. Restart your terminal.

Verify: `obsidian help` should show available commands.

The CLI lets AI agents interact with your vault natively — search, read, create notes, list tags, find orphans, all from the terminal. Requires Obsidian to be running.

Key commands for AI agents:
- `obsidian search query="..."` — full-text search
- `obsidian read` — read current/specified file
- `obsidian create name="Note Title"` — create a note
- `obsidian append content="..."` — append to a note
- `obsidian unresolved` — find broken wikilinks
- `obsidian orphans` — find unlinked notes
- `obsidian tags counts` — list all tags with frequency

### 3. Install Obsidian Git

In Obsidian: Settings → Community plugins → Browse → **Obsidian Git** → Install & Enable.

Copy the settings from [`commands/obsidian-git.example.json`](commands/obsidian-git.example.json) into `.obsidian/plugins/obsidian-git/data.json`, or configure manually:

- Auto-commit: 10 min
- Auto-push: 10 min
- Auto-pull: 30 min
- Pull on boot: on
- Pull before push: on

### 4. Set up the MCP server

```bash
cp -r <this-repo>/vault-search-mcp/ <your-vault>/vault-search-mcp/
cd <your-vault>/vault-search-mcp
npm install
```

First index:

```bash
VAULT_DIR=<path-to-your-vault> GOOGLE_API_KEY=<key> npm run index
```

Verify the embeddings pipeline actually works end-to-end:

```bash
cp eval.example.mjs eval.mjs      # still inside <your-vault>/vault-search-mcp
# edit the `tests` array in eval.mjs — a couple of queries + expected node titles from your own vault
GOOGLE_API_KEY=<key> npm run eval
```

A `HIT` line per query with a score ≥60% means the API key, the model, and the index are all wired correctly — this is the fastest way for an AI agent to confirm the MCP setup is functional before relying on `search()`/`get()` for real lookups.

Install the auto-reindex git hook (run from the vault root, which must be the git repo root):

```bash
cd <your-vault>
cp vault-search-mcp/hooks/post-commit .git/hooks/post-commit
chmod +x .git/hooks/post-commit
```

Now every Obsidian Git auto-commit will reindex the vault in the background, and the running MCP server will hot-reload the updated vectors automatically. The hook uses the repo root as `VAULT_DIR` and reads `GOOGLE_API_KEY` from your environment or, if unset, from the `.mcp.json` you create in step 5 — so it works even when git runs without your shell profile. Progress and errors go to `vault-search-mcp/reindex.log`.

### 5. Connect to Claude Code / Cursor

Create `.mcp.json` in your vault root using [`vault-search-mcp/mcp-config.example.json`](vault-search-mcp/mcp-config.example.json) as template:

```json
{
  "mcpServers": {
    "vault-search": {
      "command": "node",
      "args": ["<path>/vault-search-mcp/server.mjs"],
      "env": {
        "VAULT_DIR": "<path-to-your-vault>",
        "GOOGLE_API_KEY": "<key>"
      }
    }
  }
}
```

For **Cursor**, also add this to `~/.cursor/mcp.json` so it's available in every project.

Copy the commands and skill. The command files contain a literal `<vault-path>` placeholder — copy first, then substitute your real path in the **installed copies**, so this repo stays clean and reusable:

```bash
# Claude Code
mkdir -p ~/.claude/commands ~/.claude/skills/obsidian-vault
cp <this-repo>/commands/*.md ~/.claude/commands/
cp <this-repo>/skills/obsidian-vault/SKILL.md ~/.claude/skills/obsidian-vault/
for f in <this-repo>/commands/*.md; do
  sed -i '' "s#<vault-path>#<path-to-your-vault>#g" ~/.claude/commands/"$(basename "$f")"
done

# Cursor (it reads skills from ~/.claude/skills too, so the skill needs no second copy)
mkdir -p ~/.cursor/commands ~/.cursor/rules
cp <this-repo>/commands/*.md ~/.cursor/commands/
cp <this-repo>/commands/cursor-rule.example.mdc ~/.cursor/rules/copilot-vault.mdc
for f in <this-repo>/commands/*.md; do
  sed -i '' "s#<vault-path>#<path-to-your-vault>#g" ~/.cursor/commands/"$(basename "$f")"
done
sed -i '' "s#<vault-path>#<path-to-your-vault>#g" ~/.cursor/rules/copilot-vault.mdc
```

(`sed -i ''` is macOS/BSD syntax; drop the `''` on Linux.) If an AI agent is doing this copy for you, it should run the substitution itself, using the real absolute vault path it already knows from earlier steps — never leave `<vault-path>` unresolved in the installed files.

### 6. Set up automation hooks (optional but recommended)

```bash
mkdir -p ~/.claude/hooks
cp <this-repo>/hooks/claude-code/*.example ~/.claude/hooks/
cd ~/.claude/hooks && for f in vault-*.example; do mv "$f" "${f%.example}"; done && cd -
chmod +x ~/.claude/hooks/vault-*.sh ~/.claude/hooks/vault-*.py
```

Merge [`hooks/claude-code/settings.snippet.json`](hooks/claude-code/settings.snippet.json) into `~/.claude/settings.json`, filling in `<vault-path>` (your `Copilot-Vault/` folder) and `<vault-git-root>` (the outer git repo containing it — usually its parent, the Obsidian vault root — **not the same path**). Requires `jq` and `python3`.

**Nudge hooks — suggest only, never write anything on their own:**
- **`vault-compress-stop.py`** — `Stop` hook. Counts one turn per finished reply, per session. Once both thresholds are met (default: 6 turns **and** 45 minutes since the last nudge), it asks the AI to offer `/compress`. Set `VAULT_COMPRESS_MODE=run` in front of the command if you'd rather have the agent run `/compress` without asking — it only writes the diary entry, the two registries and the project `CLAUDE.md` Open Threads.
- **`vault-digest-gate.sh`** — `SessionStart` hook. Once enough session-diary entries have piled up undigested (default: 3), it nudges the AI to offer `/digest` at the start of the next session.

**Git sync hooks — ⚠️ these actually commit and push on their own, no confirmation.** They exist because Obsidian Git's auto-sync only runs while the Obsidian app is open — without these, a vault only ever touched through an agent never syncs to the remote at all.
- **`vault-git-sync-start.sh`** — `SessionStart` hook. Fetches and fast-forwards the default branch. If you're on a clean, unmerged `vault-heal/`/`vault-learn/` review branch, switches back to the default branch for the session (the review branch itself is left alone — merging it is still your call). Surfaces (never touches) review branches older than a week.
- **`vault-git-sync-stop.sh`** — `Stop` hook (async). No-ops instantly on a clean tree. Otherwise commits everything with a generic message and pushes the current branch. If the push fails (remote has commits you haven't pulled), it wakes the AI with a pointer to `/vault-resolve-conflict` instead of losing the work silently.

**If you also run Obsidian Git** (step 3): that plugin has its own internal auto-commit/push timer, separate from this hook — two processes pushing the same repo can race each other. `vault-git-sync-stop.sh` best-effort detects a running Obsidian process (`pgrep`) and skips its own push when Obsidian looks open, leaving that to Obsidian Git; it always commits locally regardless, since that part is safe either way. Override the process name it looks for via `VAULT_GIT_OBSIDIAN_PROCESS_NAME` if yours differs. If you never keep Obsidian open, this never triggers and the hook pushes normally on every session.

Only enable the git sync hooks if you're fine with an unattended process pushing to your vault's remote — keep that repo private, and make sure nothing else writes to it unreviewed.

**Cursor.** The same two nudges ship as local plugins in [`cursor-plugins/`](cursor-plugins/) (they need [bun](https://bun.sh) on `PATH`):

```bash
for p in vault-compress vault-digest-gate; do
  mkdir -p ~/.cursor/plugins/local/$p
  cp -R <this-repo>/cursor-plugins/$p/. ~/.cursor/plugins/local/$p/
  find ~/.cursor/plugins/local/$p -type f \( -name '*.ts' -o -name '*.md' \) \
    -exec sed -i '' "s#<vault-path>#<path-to-your-vault>#g" {} +
done
```

Restart Cursor and enable both under Settings → Plugins. `vault-digest-gate` suggests `/digest` exactly like the Claude Code hook. `vault-compress` goes one step further: after 6 turns and 45 minutes it **has the agent run `/compress`** (Cursor submits the request as a follow-up prompt), so the diary gets written without you asking. The git sync hooks are plain git + shell, portable to any harness with a session-start/session-end hook point.

### 7. Create your CLAUDE.md

Add `~/.claude/CLAUDE.md` with your vault path and conventions:

```markdown
Knowledge base (Obsidian vault) lives at: `<your-vault-path>`

## Before writing or modifying code, PRs or messages:
Search the vault first: `vault-search` MCP `search("...")`, then `get(path)` on the best match, and follow what the note says.
If the MCP server is unavailable, read `moc/Index.md` and follow the links.

## Vault commands — use proactively

| Command | When to trigger | What it does |
|---------|----------------|-------------|
| /compress | End of session | Session diary + corrections |
| /catchup | Start of session | Open Threads + project context |
| /ingest | Source in sources/ | Process source → vault update |
| /lint-obsidian | Periodically | Audit + fix on git branch |
| /learn | On demand | Find gaps → research → propose |
| /digest | On demand | Analyze diary entries for patterns |
| /vault-resolve-conflict | Real git conflict in vault files | Propose per-file resolutions, apply only what's confirmed |

## Obsidian CLI

The `obsidian` CLI is available (Obsidian must be running). Use alongside MCP:

- `obsidian search query="..."` — full-text search
- `obsidian create name="Title"` — create note
- `obsidian append content="..."` — append to note
- `obsidian unresolved` — broken wikilinks
- `obsidian orphans` — unlinked notes
- `obsidian tags counts` — tag frequency

Prefer CLI for: creating/editing notes, orphans/broken links, tag stats.
Prefer MCP for: semantic similarity search.
```

### 8. Verify

- Open Obsidian → Git plugin should pull on boot
- In Claude Code or Cursor, ask the AI to search your vault
- Run `/catchup` → should report no sessions yet
- If you set up the nudge hooks: start a new session, do a few turns of work, then check `~/.claude/hooks/state/` gets a state file after the `Stop`/`SessionStart` hooks fire once
- If you set up the git sync hooks: edit a vault file, end the turn, then check `git log` in the vault repo for the automated commit (and that it reached the remote)

## Commands

### Session pair: `/compress` + `/digest`

These two commands work together. `/compress` writes session diaries, `/digest` reads them.

| Command | What it does |
|---------|-------------|
| [`/compress`](commands/compress.md) | End-of-session: writes diary to `session-diary/`, logs corrections, tracks new things, notes open threads. Updates project CLAUDE.md. |
| [`/digest`](commands/digest.md) | Reads unprocessed `/compress` diaries (skips files with `digested: YYYY-MM-DD` in frontmatter), finds recurring corrections and patterns, and proposes new guideline nodes with draft content when a mistake repeats 3+ times. **Waits for a per-proposal yes / edit / skip before writing anything**, then marks a diary processed only once all its proposals are resolved. |

**Flow**: `/compress` at end of each session → `/digest` periodically to extract patterns from accumulated diaries.

### `/catchup`

| Command | What it does |
|---------|-------------|
| [`/catchup`](commands/catchup.md) | Start-of-session: loads last session's open threads and project context so you can resume. |

### Knowledge management: `/ingest`, `/lint-obsidian`, `/learn`

| Command | What it does |
|---------|-------------|
| [`/ingest`](commands/ingest.md) | Processes a raw source file from `sources/` into multiple vault node updates. Source stays immutable. |
| [`/lint-obsidian`](commands/lint-obsidian.md) | Audits curated notes (orphans, missing cross-refs, stale nodes, missing/thin pages, frontmatter gaps, contradictions) and auto-fixes on a `vault-heal/` branch. Never touches `session-diary/` or `sources/`. |
| [`/learn`](commands/learn.md) | Finds knowledge gaps, researches externally, proposes new nodes on a `vault-learn/` branch. Human approves. |

### `/vault-resolve-conflict`

| Command | What it does |
|---------|-------------|
| [`/vault-resolve-conflict`](commands/vault-resolve-conflict.md) | Detects real git merge conflicts in vault files, classifies each (same-fact / contradiction / additive), proposes a resolution per file. Waits for per-file confirmation; never commits or pushes. |

## Data flow

Where content comes from, where it goes, and what actually writes it. Nothing here goes through MCP — **MCP (`search`/`get`) is read-only**; every write below is the AI directly editing files, driven by a command's instructions.

```
external article/transcript/link
        │  (you drop the raw file in)
        ▼
   sources/                       — immutable once created; never edited after
        │  /ingest reads it
        ▼
   01-05 (patterns, projects, skills, workflows, …)
        │  new/updated .md nodes, full frontmatter, wikilinked from a MOC
        ▼
   git commit (Obsidian Git, or the git-sync-stop hook)
        │
        ▼
   post-commit hook → npm run index → vectors.json
        │
        ▼
   MCP server hot-reloads → search()/get() can now find it
```

```
a work session happens
        │  /compress at end of session (manual or nudged)
        ▼
   session-diary/YYYY/MM/*.md               — one file per session
        +  _retrospectives/corrections-log.md        (if corrections happened)
        +  _retrospectives/new-things-registry.md     (if something was new)
        +  CLAUDE.md "Open Threads" section updated
        │
        │  entries accumulate, unmarked (no `digested:` in frontmatter)
        ▼
   /digest (manual, or nudged once enough pile up)
        │  reads unprocessed entries, finds recurring patterns
        ▼
   proposes new/expanded nodes in 01-05 ── human approves per-proposal ──▶ written
        │
        ▼
   processed diary files get `digested: YYYY-MM-DD` in frontmatter (won't be re-read)
```

**Branch lifecycle for `/lint-obsidian` and `/learn`**: both work on a dedicated branch (`vault-heal/YYYY-MM-DD`, `vault-learn/YYYY-MM-DD-topic`), commit there, and stop — they never merge into the default branch, that's always a human decision. If you've set up the git sync hooks (step 6), the next session's `SessionStart` hook will hop you back onto the default branch automatically once that review branch's tree is clean, without touching or merging it; branches older than a week that are still unmerged get flagged so they don't just get forgotten.

## Frontmatter

Every note needs YAML frontmatter:

```yaml
---
title: Node Title
type: permanent | session | moc
tags:
  - domain/your-domain
  - type/pattern
created: YYYY-MM-DD
updated: YYYY-MM-DD
summary: "One-line English summary — this is what the search indexes."
---
```

The `summary` field drives search quality. Write it in English.

**Tags**: `prefix/value` format — define your own prefixes (`domain/`, `tool/`, `type/`, `project/`).

**Wikilinks**: `[[Node Title]]` for internal links. Add `aliases` in frontmatter for short names.

## Customization

- **Embedding provider**: Gemini is default. Swap for OpenAI/Cohere/local by replacing API calls in [`server.mjs`](vault-search-mcp/server.mjs) and [`index-vault.mjs`](vault-search-mcp/index-vault.mjs).
- **Excluded folders**: Update `EXCLUDED_PREFIXES` in [`server.mjs`](vault-search-mcp/server.mjs) and `SKIP_DIRS` in [`index-vault.mjs`](vault-search-mcp/index-vault.mjs).
- **Commands**: Edit the `.md` files in [`commands/`](commands/) to match your workflow.
- **Skill**: Edit [`SKILL.md`](skills/obsidian-vault/SKILL.md) to add your conventions and trigger phrases.

## Security

- Don't commit API keys. Use env vars or `.gitignore` the `.mcp.json`.
- `vectors.json` is gitignored — regenerate locally after cloning.
- Session diaries may contain project context. Keep the vault repo private.
- If you enabled the git sync hooks (step 6): `vault-git-sync-stop.sh` commits and pushes to your remote with no per-change confirmation. Only wire it up on a private repo you're comfortable with an unattended process pushing to, and don't point `VAULT_GIT_ROOT` at a repo shared with anything else that expects reviewed pushes.
