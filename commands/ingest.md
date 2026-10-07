---
description: "Process a raw source from sources/ into the vault"
---

Process a raw source from `sources/` into the Copilot-Vault knowledge base.

This is a multi-page operation: one source can create new nodes AND update multiple existing ones.

Vault path: `<vault-path>`

Folder names above (`sources/`) assume a plain vault layout. If yours uses numbered folders (e.g. `07-sources/`), use that instead — check the vault root `CLAUDE.md` or MOC for the actual name in use.

## Pseudocode

### Step 1: Identify the source
```
VAULT = <vault-path>
SOURCE_DIR = {VAULT}/sources/

# Find the newest file in sources/, or the one the user specified
# If user didn't specify, list recent files and ask which one
```

### Step 2: Read and analyze
```
1. Read the source file completely
2. Use vault-search MCP: search() to find related existing nodes
3. Present 3-5 key takeaways to the user
4. Ask what to emphasize (or proceed if user said "just ingest")
```

### Step 3: Determine affected nodes
```
For each concept/entity/pattern in the source:
  1. search() vault for existing node
  2. If exists → mark for UPDATE
  3. If not exists but significant → mark for CREATE

Classify each new node into the matching existing folder (check the MOC / vault root
CLAUDE.md for the layout — e.g. patterns, projects, workflows, persona, skills). Don't invent
a new top-level folder if one already fits.
```

### Step 4: Create new nodes
```
For each CREATE:
  1. Write node with full frontmatter (title, type, tags, created, updated, summary)
  2. Add sources: field referencing the sources/ file
  3. Add bidirectional [[wikilinks]] to related nodes
  4. Add a "## Related nodes" section
```

### Step 5: Update existing nodes
```
For each UPDATE:
  1. Read current node content
  2. Integrate new information — DO NOT overwrite existing content
  3. If new source CONTRADICTS existing content → note disagreement explicitly
  4. Update "updated:" date in frontmatter
  5. Add source reference if not present
  6. Add new [[wikilinks]] if applicable
```

### Step 6: Update MOCs
```
If any new node was created:
  1. Update the relevant MOC (e.g. under `moc/`)
  2. Add one-line entry with [[wikilink]] and summary
```

### Step 7: Report
```
Print:
  **Ingested**: {source filename}
  **Created**: [[Node1]], [[Node2]], ...
  **Updated**: [[Node3]] (added X), [[Node4]] (added Y), ...
  **MOCs updated**: Code Patterns MOC, Index
```

## Rules
- NEVER modify files in `sources/` — they are immutable
- NEVER touch `session-diary/` — that's `/compress`'s (write) and `/digest`'s (read+propose) territory, not `/ingest`'s. `/ingest` only reads `sources/` and only writes curated node folders.
- Every new node must have complete frontmatter (title, type, tags, created, updated, summary)
- Every factual claim must trace back to the source
- If contradictions found — note them, don't silently resolve
- Prefer updating existing nodes over creating thin new ones
- One concept per node — split if a node answers multiple questions
