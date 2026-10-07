---
description: "End-of-session compress: write a session diary entry to the vault"
---

End-of-session compress: write session diary entry.

1. Create session log file in `session-diary/{YYYY}/{MM}/{DATE}-{HHmmss}.md`
2. Fill all sections: Summary, Work Items, Decisions Made, What Was New,
   Retrospective (Corrections, What Went Wrong, Patterns Learned), Open Threads
3. Append to `session-diary/_retrospectives/corrections-log.md` if there were corrections
4. Append to `session-diary/_retrospectives/new-things-registry.md` if there were new things
5. Update the current project's `{cwd}/CLAUDE.md` `## Open Threads` section (the one `/catchup` reads)

`/compress` never touches curated node folders — turning diary into nodes is `/digest`'s job (run periodically, not every session).

Vault path: `<vault-path>`

Folder names above (`session-diary/`) assume a plain vault layout. If yours uses numbered folders (e.g. `06-session-diary/`), use that instead — check the vault root `CLAUDE.md` or MOC for the actual name in use. Don't create a second, differently-named folder next to an existing one.
