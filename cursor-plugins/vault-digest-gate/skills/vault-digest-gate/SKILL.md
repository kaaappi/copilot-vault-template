---
name: vault-digest-gate
description: Offer /digest via obsidian-vault after the sessionStart hook flags a backlog of undigested session-diary entries.
disable-model-invocation: true
---

# Vault Digest Gate

Suggest running `/digest` when the `vault-digest-gate` sessionStart hook flags a backlog.

## Trigger

- SessionStart hook `additional_context` mentions undigested session-diary entries.
- User says `/digest`, "what keeps repeating", "error patterns".

## Workflow

1. Read the `obsidian-vault` skill and the `/digest` command spec.
2. Scan the vault's session-diary folder for dated entries without `digested:` in frontmatter.
3. Analyze patterns (recurring corrections, topics, new things) and draft a proposal per finding — actual node content, not a one-line description.
4. Present each draft and **wait for per-proposal confirmation** (yes / edit / skip) before writing anything.
5. Write only confirmed proposals into the curated note folders — new node or expand existing, `sources:` pointing at the diary file(s).
6. Mark a diary file `digested: YYYY-MM-DD` only once its proposals are fully resolved (written or explicitly skipped). Deferred ones stay unmarked and resurface next time.

## Guardrails

- Vault path: `<vault-path>/`
- Never write a node before the user has confirmed that specific proposal.
- Never touch `sources/` — that's `/ingest`'s territory.
- Never write into the session diary beyond the `digested:` marker.
