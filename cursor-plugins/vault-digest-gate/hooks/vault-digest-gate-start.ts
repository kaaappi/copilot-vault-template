/// <reference types="bun-types-no-globals/lib/index.d.ts" />

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { stdin } from "bun";

const STATE_PATH = resolve(".cursor/hooks/state/vault-digest-gate.json");
// `<vault-path>` is substituted at install time (AGENTS.md); VAULT_DIR overrides it.
const VAULT_PATH = (process.env.VAULT_DIR ?? "<vault-path>").replace(/\/+$/, "");
// Plain layout first, numbered (Karpathy-style) as the fallback.
const DIARY_DIR = existsSync(`${VAULT_PATH}/session-diary`)
  ? `${VAULT_PATH}/session-diary`
  : `${VAULT_PATH}/06-session-diary`;
const DATED_ENTRY = /^\d{4}-\d{2}-\d{2}-.+\.md$/;

const DEFAULT_THRESHOLD = 3;

interface SessionStartHookInput {
  session_id: string;
  is_background_agent?: boolean;
  composer_mode?: string;
}

interface VaultDigestGateState {
  version: 1;
  lastNudgedCount: number;
}

function loadState(): VaultDigestGateState {
  const fallback: VaultDigestGateState = { version: 1, lastNudgedCount: 0 };
  if (!existsSync(STATE_PATH)) return fallback;
  try {
    const parsed = JSON.parse(readFileSync(STATE_PATH, "utf-8")) as Partial<VaultDigestGateState>;
    if (parsed.version !== 1) return fallback;
    return {
      version: 1,
      lastNudgedCount:
        typeof parsed.lastNudgedCount === "number" && Number.isFinite(parsed.lastNudgedCount) && parsed.lastNudgedCount >= 0
          ? parsed.lastNudgedCount
          : 0,
    };
  } catch {
    return fallback;
  }
}

function saveState(state: VaultDigestGateState): void {
  const directory = dirname(STATE_PATH);
  if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}

// Dated session logs only — skips _retrospectives/ (running registries) and any
// non-dated file such as a folder README. Mirrors the Claude Code vault-digest-gate.sh scan.
function listSessionDiaryFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "_retrospectives") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSessionDiaryFiles(full));
    } else if (entry.isFile() && DATED_ENTRY.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function isUndigested(filePath: string): boolean {
  try {
    const content = readFileSync(filePath, "utf-8");
    return !/^digested:/m.test(content);
  } catch {
    return false;
  }
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

async function parseHookInput<T>(): Promise<T> {
  const text = await stdin.text();
  return JSON.parse(text) as T;
}

async function main(): Promise<number> {
  try {
    await parseHookInput<SessionStartHookInput>(); // input isn't used, but stdin must be drained
    const state = loadState();

    const threshold = parsePositiveInt(process.env.VAULT_DIGEST_GATE_THRESHOLD, DEFAULT_THRESHOLD);
    const undigestedCount = listSessionDiaryFiles(DIARY_DIR).filter(isUndigested).length;

    // /digest ran since the last nudge — re-arm from the new, lower baseline.
    if (undigestedCount < state.lastNudgedCount) {
      state.lastNudgedCount = undigestedCount;
      saveState(state);
    }

    // Re-arm only once the undigested count has actually grown past the last
    // nudge — count-based, not time-based, so it can't spam every session once
    // the threshold is crossed.
    if (undigestedCount < threshold || undigestedCount <= state.lastNudgedCount) {
      console.log(JSON.stringify({}));
      return 0;
    }

    state.lastNudgedCount = undigestedCount;
    saveState(state);

    const context =
      `${undigestedCount} session-diary entries haven't been run through /digest yet ` +
      `(no 'digested:' in frontmatter). Suggest the user run /digest — it analyzes patterns ` +
      `and proposes new/expanded nodes, but writes nothing without confirmation. ` +
      `Don't run it yourself without confirmation.`;

    console.log(JSON.stringify({ additional_context: context }));
    return 0;
  } catch (error) {
    console.error("[vault-digest-gate] failed", error);
    console.log(JSON.stringify({}));
    return 0;
  }
}

const exitCode = await main();
process.exit(exitCode);
