---
description: "Meta-analysis of session diary entries → proposed notes (works with /compress)"
---

Meta-analysis of session diary entries. Works with `/compress` output.

Vault path: `<vault-path>`

Folder names above (`session-diary/`) assume a plain vault layout. If yours uses numbered folders (e.g. `06-session-diary/`), use that instead — check the vault root `CLAUDE.md` or MOC for the actual name in use.

## Steps

### 1: Find unprocessed diaries
```
Scan session-diary/ for dated session-log files only: {YYYY}/{MM}/{DATE}-{HHmmss}.md.
Exclude `_retrospectives/` (corrections-log.md, new-things-registry.md — running
registries, not session entries) and any other non-dated file under session-diary/
(e.g. a folder README.md) — these must never be treated as a session log or get a
`digested:` field written into them.
Skip files that have `digested: YYYY-MM-DD` in their frontmatter — already processed.
Only analyze unprocessed files.
If no unprocessed files → report "nothing new to digest" and stop.
```

### 2: Analyze patterns
```
Read all unprocessed session diaries.
Extract:
  - Recurring corrections (from Retrospective sections)
  - Dominant topics (from Work Items)
  - New things learned (from What Was New)
Group by category. Count occurrences.
```

### 3: Propose actions
```
If a correction category appears 3+ times → propose a new guideline node
If a pattern appears 3+ times → propose extracting to a pattern node
If a new tool/library appears 2+ times → propose a reference node

For each proposal, prepare a draft: target node (new title + folder, or existing
node to expand), and the actual content to add — not just a one-line description.
```

### 4: Present for confirmation — wait, don't write yet
```
Print each proposal with its draft content:

  Proposal 1: Create [[Node Title]] in {folder}
  Because: {N} sessions show {pattern/correction/tool}, no node covers it yet
  Draft content:
  ---
  {actual draft body — frontmatter + content, ready to save as-is}
  ---
  Apply? (yes / edit / skip)

WAIT for an explicit answer per proposal before writing anything. This mirrors
/lint-obsidian and /learn — propose, human confirms, only then write.
```

### 5: Write confirmed proposals (node-writing rules from /ingest)
```
For each "yes" or "edit" (with the user's edits applied):
  If CREATE: write node with full frontmatter (title, type, tags, created, updated, summary),
             sources: field pointing to the session-diary file(s) this came from
             (NOT sources/ — those are for /ingest's external material only),
             bidirectional [[wikilinks]], add MOC entry
  If EXPAND: read existing node, integrate new content without overwriting what's there,
             update `updated:` date, add sources: reference if not present

Never write anything for a "skip".
```

### 6: Mark as processed
```
For each session diary file whose proposals were all resolved (confirmed-and-written OR
explicitly skipped — "skip" still counts as resolved, just add `digested: YYYY-MM-DD`
without a node write):
  Add `digested: YYYY-MM-DD` to its YAML frontmatter.

If the user deferred a proposal ("later", didn't answer) — do NOT mark that diary file
as digested. It should resurface on the next /digest run.

This ensures future /digest runs skip only genuinely-resolved files.
```

### 7: Report
```
Print:
  **Digest** — {DATE}
  **Sessions analyzed**: {N} (skipped {M} already digested)

  Patterns found:
  - [CORRECTION x{N}] {category} — {summary}
  - [TOPIC x{N}] {topic} — appeared in {sessions}
  - [NEW THING x{N}] {tool/pattern}

  Applied ({K}):
  - [[Node1]] — created in {folder}
  - [[Node2]] — expanded with {what}

  Skipped/deferred ({M}):
  - {proposal} — {reason if given}
```

## Rules
- NEVER write into `session-diary/` — only read it and add the `digested:` marker
- NEVER touch `sources/` — that's `/ingest`'s territory
- Writes go only to curated note folders, and only after per-proposal confirmation
