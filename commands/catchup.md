---
description: "Resume from the last session diary (Open Threads + project context)"
---

Session resume: show context from last session.

**Do NOT use MCP `search`/`get` for this.** Read files directly — session diaries are chronological logs, not semantic-search targets (the index skips them).

## Steps

1. Determine the current project: `basename(cwd)`.
2. Find the last session log:
   - Look in `session-diary/**/*.md` — only dated files (`{DATE}-{HHmmss}.md`); skip `_retrospectives/` and any non-dated file (e.g. a folder README) — sorted by date/time, newest first.
   - Prefer the newest file whose frontmatter `project` matches the current project.
   - Fallback: if nothing matches, use the newest file overall and say it comes from a different project.
3. Read that file's `## Open Threads` section.
4. Read `{cwd}/CLAUDE.md` if it exists → its own `## Open Threads` section.
5. Present:
   ```
   **Last session** ({date}, {project}):
   {Open Threads bullets}

   **Project context**:
   {project CLAUDE.md key sections, if present}
   ```

## Edge cases

- No session logs at all → "No previous sessions. Starting fresh."
- Project doesn't match any log → show the latest global entry and say so explicitly.
- No project `CLAUDE.md` → skip that section, show only the diary's Open Threads.

Vault path: `<vault-path>`

Folder names above (`session-diary/`) assume a plain vault layout. If yours uses numbered folders (e.g. `06-session-diary/`), use that instead — check the vault root `CLAUDE.md` or MOC for the actual name in use.
