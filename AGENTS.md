# Setup — read this first

This folder is the `copilot-vault-template` engine: an MCP semantic-search server, AI slash commands, a vault lookup skill, and optional automation hooks for Claude Code and Cursor. It contains **no notes** — you point it at a vault, either an existing folder of markdown notes or a fresh one you create in step 1.

Hand this whole folder to a coding agent and ask it to set itself up. Every step below except the ones marked **(human)** can be done autonomously — do them in order, and stop to ask only where marked. [`README.md`](README.md) describes the same setup for a human reader and explains what each step does; when the two ever disagree, this file wins for an agent-run install.

Two paths are used throughout. Resolve both once and reuse them:

- `<repo>` — the absolute path of this folder.
- `<vault>` — the absolute path of the notes folder chosen in step 1.

## 1. Choose the vault (human)

**Stop and ask the user directly** — don't pick a location on your own:

> "Do you already have a folder of markdown notes I should use (an Obsidian vault or any other), or should I create a fresh one? If fresh, where should it live?"

- **Existing vault**: note its absolute path as `<vault>`. Check that its notes carry YAML frontmatter with a `summary:` line — search quality depends on it (see README, "Frontmatter"). Count the notes without one and report the number; don't rewrite anything unasked.
- **Fresh vault**: create the minimum structure at the path they gave (suggest a sibling of this folder named `my-vault` if they have no preference):

  ```bash
  mkdir -p <vault>/moc <vault>/sources <vault>/session-diary/_retrospectives
  touch <vault>/sources/.gitkeep <vault>/session-diary/_retrospectives/.gitkeep   # git drops empty folders
  ```

  Then create `<vault>/moc/Index.md` with frontmatter (`title`, `type: moc`, `tags`, `created`, `updated`, `summary`) and one line saying what the vault is for. Search needs a few real notes to be meaningful, so ask the user for two or three conventions they want their agent to follow, and write each as a short note with full frontmatter and an English `summary:`. Link them from `Index.md`.

## 2. Install the MCP server

Node.js v18+ is required — check `node -v` first; stop and tell the user if it's missing.

The server lives inside the vault, next to the notes, so the git post-commit hook in step 9 can find it:

```bash
cp -r <repo>/vault-search-mcp <vault>/vault-search-mcp
cd <vault>/vault-search-mcp
npm install
```

From here on, `<mcp>` means `<vault>/vault-search-mcp`.

## 3. Get a Gemini API key (human, unless already available)

Check first whether `GOOGLE_API_KEY` is already set in the shell environment, or an existing `.mcp.json` already sits in `<vault>` — reuse it if so. Otherwise, ask the user for a key from https://aistudio.google.com/apikey (free tier is enough) and confirm the resulting key before continuing. Do not proceed to indexing without one.

## 4. Build the index

From `<mcp>`:

```bash
VAULT_DIR=<vault> GOOGLE_API_KEY=<key> npm run index
```

This writes `<mcp>/vectors.json` (gitignored — expected, you're generating it now). `sources/`, `session-diary/`, `_templates/` and `node_modules/` are skipped on purpose: raw material and logs are not search targets.

## 5. Verify it actually works

```bash
cp eval.example.mjs eval.mjs
```

Replace the two placeholder entries in the `tests` array with two or three real ones from this vault. Read the titles of some notes that exist, then phrase each query in your own words rather than copying the title, so the test proves search by meaning and not by name:

```js
const tests = [
  { q: "how do we structure a modal", expect: "Modal Pattern" },
  { q: "keep changes small and on topic", expect: "Scope Discipline" },
];
```

```bash
GOOGLE_API_KEY=<key> npm run eval
```

Expect `HIT` lines with score ≥60% for each query. If you get `MISS` or errors, debug before continuing — likely causes: wrong `VAULT_DIR`, index not built (step 4), or a bad/expired key. Report the eval output to the user as proof the search pipeline works end-to-end.

## 6. Create `.mcp.json`

In `<vault>`, using [`vault-search-mcp/mcp-config.example.json`](vault-search-mcp/mcp-config.example.json) as the template, with absolute paths:

```json
{
  "mcpServers": {
    "vault-search": {
      "command": "node",
      "args": ["<mcp>/server.mjs"],
      "env": {
        "VAULT_DIR": "<vault>",
        "GOOGLE_API_KEY": "<key>"
      }
    }
  }
}
```

Do not commit this file if the vault is (or becomes) a git repo — it holds a live API key. Add `.mcp.json` to the vault's `.gitignore`.

For Cursor, the same block also goes into `~/.cursor/mcp.json`.

## 7. Install commands + skill

The command files contain a literal `<vault-path>` placeholder. Copy them first, then substitute it in the **installed copies** — never in `<repo>`, so this folder stays clean and can be installed against another vault later:

```bash
mkdir -p ~/.claude/commands ~/.claude/skills/obsidian-vault
cp <repo>/commands/*.md ~/.claude/commands/
cp <repo>/skills/obsidian-vault/SKILL.md ~/.claude/skills/obsidian-vault/

for f in <repo>/commands/*.md; do
  sed -i '' "s#<vault-path>#<vault>#g" ~/.claude/commands/"$(basename "$f")"
done
# (drop the '' after -i on Linux)

grep -l '<vault-path>' ~/.claude/commands/*.md   # must print nothing
```

If Cursor is used on this machine (`~/.cursor` exists), install the same commands there, plus the always-apply rule:

```bash
mkdir -p ~/.cursor/commands ~/.cursor/rules
cp <repo>/commands/*.md ~/.cursor/commands/
cp <repo>/commands/cursor-rule.example.mdc ~/.cursor/rules/copilot-vault.mdc
for f in ~/.cursor/commands/*.md ~/.cursor/rules/copilot-vault.mdc; do
  sed -i '' "s#<vault-path>#<vault>#g" "$f"
done
grep -l '<vault-path>' ~/.cursor/commands/*.md ~/.cursor/rules/copilot-vault.mdc   # must print nothing
```

Cursor reads skills from `~/.claude/skills/` too, so the skill needs no second copy.

Use the real absolute path in place of `<vault>` — you already resolved it in step 1. If `~/.claude/commands/` (or `~/.cursor/commands/`) already has a file with the same name as one of these, ask before overwriting it. The command files also carry a note about numbered folders (`06-session-diary/` instead of `session-diary/`): if the vault uses numbered folder names, the commands adapt to whatever the vault root `CLAUDE.md` or MOC calls them.

## 8. Point `~/.claude/CLAUDE.md` at this vault

Use the snippet in [`README.md`](README.md), "7. Create your CLAUDE.md", replacing the path with `<vault>`. If `~/.claude/CLAUDE.md` doesn't exist yet, create it from that snippet. If it already exists, merge in the vault-pointer and command-table sections instead of overwriting whatever else is there — ask the user first if the existing file looks substantial.

## 9. Set up git and the auto-reindex hook — ask first, don't guess

Check first: is `<vault>` already inside a git repo (`git -C <vault> rev-parse --show-toplevel`)? Call that path `<vault-git-root>`.

- If there is no repo, `git init` in `<vault>` (it becomes `<vault-git-root>`) and add `vectors.json`, `node_modules/` and `.mcp.json` to `.gitignore`.
- If `<vault-git-root>` is not `<vault>` itself, the post-commit hook below will not find `vault-search-mcp/`; tell the user and skip the hook, they can run `npm run index` by hand.

Install the hook, which reindexes after each commit and lets the running server hot-reload the result. It needs no configuration: `VAULT_DIR` is the repo root, and `GOOGLE_API_KEY` is read from the environment or from `<vault>/.mcp.json` (step 6). It logs to `<mcp>/reindex.log`:

```bash
cp <mcp>/hooks/post-commit <vault-git-root>/.git/hooks/post-commit
chmod +x <vault-git-root>/.git/hooks/post-commit
```

Then check for a remote: `git remote -v`. If `origin` is already set, continue to step 10.

Otherwise, **stop and ask the user directly** — don't pick a repo name, visibility, or hosting on your own:

> "This vault isn't connected to a remote yet. Where should it live?
> 1. Create a new private GitHub repo now (I'll run `gh repo create` — needs `gh auth status` already logged in)
> 2. I already have an empty remote repo — give me the URL and I'll add it as `origin`
> 3. Skip for now — I'll set this up later"

Then, based on their answer:

- **Option 1**: confirm a repo name with them (suggest one based on the vault folder's name, but don't invent one silently), then `gh repo create <name> --private --source=. --remote=origin --push`.
- **Option 2**: `git remote add origin <url>`, then `git add -A && git commit -m "initial vault import" && git push -u origin main`.
- **Option 3**: skip step 11 below (the git sync hooks need `origin` to push to) and note that in your final report.

Never run `gh repo create` or `git remote add` without them having explicitly picked one of the above — this creates a real, possibly-public repo, which is exactly the kind of visible action that needs a yes first, not an assumption. Keep the vault repo **private**: vault content usually includes project and work context.

## 10. Optional: nudge hooks (`/compress` + `/digest`) — safe, suggest-only

```bash
mkdir -p ~/.claude/hooks
cp <repo>/hooks/claude-code/vault-compress-stop.py.example ~/.claude/hooks/vault-compress-stop.py
cp <repo>/hooks/claude-code/vault-digest-gate.sh.example ~/.claude/hooks/vault-digest-gate.sh
chmod +x ~/.claude/hooks/vault-compress-stop.py ~/.claude/hooks/vault-digest-gate.sh
```

Needs `python3` (compress hook) and `jq` (digest gate) on the user's machine — check both, install what is missing.

- `vault-compress-stop.py` (`Stop`): after 6 turns and 45 minutes in a session, asks the agent to suggest `/compress`.
- `vault-digest-gate.sh` (`SessionStart`): once 3 session-diary entries are still undigested, asks the agent to suggest `/digest`.

These only ever suggest running `/compress` or `/digest` — they never write anything or touch git. Safe to install without asking. If the user wants `/compress` to run on its own instead of being offered, add `VAULT_COMPRESS_MODE=run` in front of the command in the settings snippet below — ask first, it is their call.

### Cursor plugins (`vault-compress` + `vault-digest-gate`)

The Cursor versions of the two hooks above. Install them whenever Cursor is used (`~/.cursor` exists). They need [bun](https://bun.sh) on `PATH` — check with `bun --version`, install it if missing (`brew install bun`, or `curl -fsSL https://bun.sh/install | bash`).

```bash
for p in vault-compress vault-digest-gate; do
  mkdir -p ~/.cursor/plugins/local/$p
  cp -R <repo>/cursor-plugins/$p/. ~/.cursor/plugins/local/$p/
  find ~/.cursor/plugins/local/$p -type f \( -name '*.ts' -o -name '*.md' \) \
    -exec sed -i '' "s#<vault-path>#<vault>#g" {} +
done
grep -rl '<vault-path>' ~/.cursor/plugins/local/vault-compress ~/.cursor/plugins/local/vault-digest-gate   # must print nothing
```

One difference from Claude Code: in Cursor, `vault-compress` does not suggest, it **has the agent run `/compress`** after 6 turns and 45 minutes. That writes one diary file (plus the registries and the project `CLAUDE.md` Open Threads) inside the vault and nothing else — no git. Tell the user this before installing it. `vault-digest-gate` only suggests `/digest`, same as in Claude Code.

Then **(human)**: restart Cursor, open Settings → Plugins, and check that **vault-compress** and **vault-digest-gate** are both enabled.

## 11. Optional: git sync hooks — ⚠️ auto-pushes once wired, needs step 9's remote

```bash
cp <repo>/hooks/claude-code/vault-git-sync-start.sh.example ~/.claude/hooks/vault-git-sync-start.sh
cp <repo>/hooks/claude-code/vault-git-sync-stop.sh.example ~/.claude/hooks/vault-git-sync-stop.sh
chmod +x ~/.claude/hooks/vault-git-sync-start.sh ~/.claude/hooks/vault-git-sync-stop.sh
```

These exist because Obsidian Git's own auto-sync (its internal plugin timer, not a Claude Code hook) only runs while the Obsidian app is open — without these, working through an agent alone never syncs the vault to its remote at all. Once wired, the `Stop` hook **commits and pushes vault changes automatically, with no per-change confirmation**. Confirm with the user before wiring it if that isn't obviously already the intent of this setup pass.

**If Obsidian Git is also installed** (step 3 of [`README.md`](README.md)): both it and this hook can commit and push the same repo independently. `vault-git-sync-stop.sh` best-effort detects a running Obsidian process and skips its own *push* when Obsidian looks open (it still commits locally regardless, that part is always safe), leaving pushing to Obsidian Git in that case.

Merge [`hooks/claude-code/settings.snippet.json`](hooks/claude-code/settings.snippet.json) into `~/.claude/settings.json` for whichever hooks you installed (steps 10 and/or 11), filling in `<vault-path>` = `<vault>`, and `<vault-git-root>` = the outer git repo from step 9. These are usually different paths when the notes live in a subfolder. Copy only the entries for hooks you actually installed.

## 12. Report back

Tell the user: what got installed and where (Claude Code and/or Cursor), the eval result from step 5, how many notes lack a `summary:` (existing vaults), which remote-setup option they picked in step 9 (or that it's still pending), whether the git sync hooks got wired, and which of the human-only items below still need them.

## Needs a human — don't attempt these yourself

- Choosing the vault and, for a fresh one, telling you which conventions belong in the first notes
- Installing the Obsidian app and opening the vault folder in it (GUI-only)
- Enabling the Obsidian CLI: Obsidian → Settings → General → Command line interface → Enable
- Installing the Obsidian Git community plugin from inside Obsidian (optional, only if they also want sync while the Obsidian app itself is open; see [`README.md`](README.md) step 3)
- Supplying the Gemini API key, if step 3 didn't find one already
- Restarting Cursor and enabling the two plugins under Settings → Plugins, if they were installed in step 10
- Choosing the remote-setup option in step 9 — you execute it once they've chosen, but the choice itself is theirs
- Any other `git commit` / `git push` outside of what steps 9 and 11 are explicitly set up to do on their own, and anything in `~/.claude/` generally — prepare and describe changes, but don't push without asking

## What this folder does not contain

No notes. The vault is whatever you pointed `<vault>` at; the commands and the search server work with any folder of markdown that has frontmatter. For the recommended structure and the reasoning behind it, see README, "Vault structure".
