---
name: vault-compress
description: Orchestrate periodic /compress diary writes via obsidian-vault after eligible stop-hook triggers.
disable-model-invocation: true
---

# Vault Compress

Write session diary entries to the vault when the `vault-compress` stop hook fires.

## Trigger

- Stop hook `followup_message` asks to run this skill.
- User says `/compress`, "write up the session", or "compress vault".

## Workflow

1. Read the `obsidian-vault` skill and the `/compress` command spec.
2. Execute `/compress` for the **current** session transcript.
3. Capture explicit user preferences, corrections, and durable patterns from the chat.
4. Skip secrets and one-off noise.
5. If nothing diary-worthy exists, respond exactly: `No vault diary updates.`

## Guardrails

- Vault path: `<vault-path>/`
- Writes only the diary entry, the two registries and the project `CLAUDE.md` Open Threads — never curated notes (that is `/digest`), never `sources/`.
- No git: committing and pushing are not this skill's job.
