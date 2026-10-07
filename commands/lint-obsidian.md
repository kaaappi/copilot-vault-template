---
description: "Full vault audit + auto-fix on a separate git branch"
---

Full audit + auto-fix of the Copilot-Vault knowledge base. All changes on a separate git branch.

Vault path: `<vault-path>`

## Pseudocode

### Step 1: Setup
```
VAULT = <vault-path>
cd "$(git -C <vault-path> rev-parse --show-toplevel)"   # the git repo that contains the vault

# Ensure clean working tree
git status --porcelain
# If dirty → ask user to commit or stash first

# Create heal branch
BRANCH = vault-heal/$(date +%Y-%m-%d)
# Append -2, -3 etc. if branch exists
git checkout -b {BRANCH}
```

### Step 2: Audit — scan for 7 gap types

**Scope: curated node folders only.** **Curated node folders** below means every folder that holds real notes — i.e. everything except `session-diary/`, `sources/` and `_templates/` (the MOC/index files are read for cross-links, not linted as nodes).
**`session-diary/` and `sources/` are NEVER scanned, read, or touched by this command** — session
diary is raw dated log (owned by `/compress` + `/digest`), `sources/` is immutable raw material.
Linting them as if they were curated nodes doesn't make sense (they're not nodes, they're logs/sources).

If your vault uses numbered folders (e.g. `06-session-diary/`, `07-sources/`), apply the same rule to those names.

```
1. ORPHAN PAGES — nodes with zero inbound [[wikilinks]]
   - Scan all .md files in the curated node folders
   - For each node, grep all other files for [[Title]]
   - If zero inbound links (excluding self) → orphan

2. MISSING CROSS-REFERENCES — nodes that should link to each other
   - If node A mentions concept from node B but doesn't [[link]] → flag
   - Use vault-search MCP to find semantically related nodes without links

3. STALE NODES — nodes with updated: date older than 60 days
   - Read frontmatter of all nodes
   - If updated: < (today - 60 days) → flag

4. MISSING PAGES — concepts mentioned 2+ times across vault without own node
   - Scan for [[broken links]] (wikilinks that don't resolve to a file), within the curated node folders only

5. FRONTMATTER GAPS — nodes missing required fields
   - Required: title, type, tags, created, updated, summary
   - Check every .md file in the curated node folders

6. CONTRADICTIONS — conflicting recommendations across nodes
   - Use vault-search MCP to find nodes on similar topics
   - Compare key claims — flag if they disagree

7. THIN NODES — existing nodes with real content but too shallow to be useful
   - Node exists (not orphan/missing) but body is < ~3 sentences, or is a stub with only frontmatter
   - Body doesn't actually answer what its own summary/title promises
```

### Step 3: Fix
```
For each finding (by severity: HIGH → MEDIUM → LOW):

  ORPHAN → Add [[wikilinks]] from relevant nodes + MOC entry
  MISSING CROSS-REF → Add bidirectional [[wikilinks]]
  STALE → If content still accurate, update date; if outdated, update content
  MISSING PAGE → Web-research (see below) → create node with real content, not a bare stub
  THIN NODE → Web-research (see below) → expand in place, don't just pad frontmatter
  FRONTMATTER GAP → Fill missing fields
  CONTRADICTION → Add explicit note in both nodes, do NOT silently resolve
```

### Step 3a: Web-research for MISSING PAGE / THIN NODE

Only for these two finding types — everything else in Step 3 is pure vault editing, no browsing needed.

```
For each MISSING PAGE or THIN NODE:
  1. Web search: prefer official docs, established sources — same quality bar as /learn
     (reject SEO spam / content-farm / AI-filler results)
  2. Minimum 1 source per factual claim (lint runs unattended more often than /learn,
     so keep it to 1 quick pass per node — if a claim needs deeper research with 2+
     sources, flag it as [NEEDS-LEARN] instead of guessing from a single thin source)
  3. Write real content, not a placeholder — same node-writing rules as /ingest
     (full frontmatter, sources: field with the URL(s) used, bidirectional [[wikilinks]])
  4. If nothing decent turns up after a couple of searches — leave it flagged in the
     report as [MISSING PAGE — unresourced], don't force a low-quality node
```

This folds `/learn`'s web-research step directly into lint instead of requiring a separate manual `/learn` run — `/learn` still exists on its own for the deeper, human-gated gap-hunting (thin folders, correction clusters), since that needs a wait-for-approval step this fully-automated pass doesn't.

### Step 4: Commit and report
```
git add <vault-path>
git commit -m "vault-heal: {N} issues fixed, {M} skipped"
# Do NOT merge into main

Print:
  **Vault heal** — {DATE}
  **Branch**: {BRANCH}
  
  Fixed ({N}):
  - [ORPHAN] [[Node1]] — added links from [[Node2]], [[MOC]]
  - [FRONTMATTER] [[Node3]] — added missing summary
  - ...
  
  Skipped ({M}):
  - [CONTRADICTION] [[Node4]] vs [[Node5]] — needs human judgment
  - ...
  
  Review: git diff main..{BRANCH}
  Merge:  git checkout main && git merge {BRANCH}
```

## Rules
- ALL changes on a separate branch — never commit to main directly
- Never delete nodes — flag for human review instead
- Never silently resolve contradictions
- Prefer updating existing nodes over creating new ones
- Every new/expanded node must have complete frontmatter and a `sources:` field when web-researched
- Never fabricate content to avoid a web search — flag `[MISSING PAGE — unresourced]` instead
- Never scan, read, or write `session-diary/` or `sources/` — that's `/digest`'s and `/ingest`'s job respectively
- If vault has < 5 nodes → skip, nothing meaningful to audit
