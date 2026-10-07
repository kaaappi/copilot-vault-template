---
description: "Find vault knowledge gaps and research external sources (human approves)"
---

Find knowledge gaps in the Copilot-Vault and research external sources to fill them. Human approves before any changes.

Vault path: `<vault-path>`

Folder names above (`session-diary/` and `sources/`) assume a plain vault layout. If yours uses numbered folders (e.g. `07-sources/`), use that instead — check the vault root `CLAUDE.md` or MOC for the actual name in use.

## Pseudocode

### Step 1: Scan for gaps
```
VAULT = <vault-path>

Three gap sources:

1. THIN AREAS — folders with < 3 nodes, or topics mentioned but not covered
   - Count nodes per folder
   - Use vault-search MCP to find topics referenced but without their own node

2. DIARY PATTERNS — recurring themes in session diary without pattern nodes
   - Scan session-diary/ for recent sessions
   - Extract topic tags and Work Items
   - If a topic appears 3+ times but has no pattern/reference node → gap

3. CORRECTION CLUSTERS — correction categories with 3+ entries but no guideline
   - Read session-diary/_retrospectives/corrections-log.md
   - Group by category
   - If a category has 3+ entries and no corresponding guideline node → gap
```

### Step 2: Present gaps to user
```
Print:
  **Knowledge gaps found**: {N}

  Top priorities:
  1. [THIN AREA] {topic} — mentioned in {X} sessions, no dedicated node
  2. [CORRECTION CLUSTER] {category} — {N} corrections, no guideline
  3. [MISSING DEPTH] {node} — exists but only {2} sentences
  ...

  Which gaps should I research? (all / pick numbers / skip)
```

### Step 3: Research (only approved gaps)
```
For each approved gap:
  1. Web search for high-quality sources (docs, articles, known authorities)
  2. Quality gates:
     - Minimum 2 independent sources per factual claim
     - Reject SEO spam, content farms, AI-generated filler
     - Prefer official documentation, established blogs, conference talks
  3. Save raw research material to sources/ as:
     {DATE}-{topic-slug}.md with source URLs and key excerpts
```

### Step 4: Create/update nodes
```
cd "$(git -C <vault-path> rev-parse --show-toplevel)"   # the git repo that contains the vault
git checkout -b vault-learn/$(date +%Y-%m-%d)

For each researched gap:
  1. If node exists → update with new information
  2. If node doesn't exist → create with full frontmatter
  3. Add sources: field referencing sources/ file
  4. Add bidirectional [[wikilinks]]
  5. Update relevant MOC

git add <vault-path> && git commit -m "vault-learn: {N} gaps researched"
# Do NOT merge
```

### Step 5: Report
```
Print:
  **Vault learn** — {DATE}
  **Branch**: vault-learn/{DATE}
  **Gaps researched**: {N}

  New/updated nodes:
  - [[Node1]] — {summary of what was added} (sources: {k})
  - [[Node2]] — {summary} (sources: {k})

  Sources saved:
  - sources/{filename1}.md
  - sources/{filename2}.md

  Review: git diff main..vault-learn/{DATE}
  Merge:  git checkout main && git merge vault-learn/{DATE}
```

## Rules
- ALWAYS present gaps and wait for human approval before researching
- All changes on a separate git branch — never main
- Every claim needs 2+ independent sources
- Save raw research to sources/ (immutable once saved)
- Prefer updating existing nodes over creating thin stubs
- Small batches: top 3 gaps per run unless user asks for more
- Do NOT auto-merge — user reviews via git diff
