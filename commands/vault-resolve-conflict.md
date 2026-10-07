---
description: "Resolve real git merge conflicts in vault files (propose only, human confirms)"
---

Detect and propose resolutions for real git merge conflicts in the vault. AI proposes, human confirms — never auto-applies.

Vault path: `<vault-path>`

## Pseudocode

### Step 1: Detect
```
cd <vault-path>   # git commands work from anywhere inside the vault repo

# Conflicted files (mid-merge) or files still carrying unresolved markers
git diff --name-only --diff-filter=U
grep -rl '^<<<<<<< ' <vault-path>/ 2>/dev/null

If none found → report "No conflicts found" and stop.
```

### Step 2: For each conflicted file — propose, don't apply
```
For each file with conflict markers:
  1. Read the file, extract the conflicting hunks (<<<<<<< / ======= / >>>>>>>)
  2. Read both sides in full context (surrounding node content, frontmatter)
  3. Classify the conflict:
     - SAME FACT, DIFFERENT WORDING → propose keeping the clearer/more complete version
     - DIFFERENT FACTS (actual contradiction) → do NOT propose a merge; per lint's
       "never silently resolve contradictions" rule, propose keeping BOTH explicitly
       labeled (e.g. "as of {date-A}: X; as of {date-B}: Y — needs review") rather
       than picking a winner
     - ADDITIVE (both sides added different, non-overlapping content) → propose
       combining both, deduped
  4. Draft the proposed resolved version of the hunk
```

### Step 3: Present for confirmation
```
Print, per file:
  **{filename}** — {N} conflict(s)

  Conflict 1: {classification}
  --- theirs ---
  {side A}
  --- ours ---
  {side B}
  --- proposed resolution ---
  {draft}

  Apply this? (yes / no / edit)

WAIT for explicit per-file confirmation. Never resolve+commit without it.
```

### Step 4: Apply only confirmed resolutions
```
For each confirmed file:
  1. Replace the conflict markers with the approved resolution
  2. git add {file}

After all files handled:
  If all conflicts resolved: suggest `git commit` (don't run it — user commits)
  If some skipped: list which files still need manual resolution
```

## Rules
- Never auto-apply a resolution without per-file confirmation
- Never silently pick a side for an actual factual contradiction — always surface both
- Never `git commit` or `git push` — stop after `git add`, human commits
- If a conflict spans more than ~30 lines or touches frontmatter structurally, flag as "too complex for auto-proposal — resolve manually" instead of guessing

## Note on scope
This command assumes a single-user vault (not a team), synced across your own devices via plain git. Real conflicts should be rare (sequential usage). It exists for when they do happen — not a substitute for real-time multi-writer collaboration (that would need something like the Relay plugin, which is paid and out of scope here).
