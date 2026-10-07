/// <reference types="bun-types-no-globals" />

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { stdin } from "bun";

const STATE_PATH = resolve(".cursor/hooks/state/vault-compress.json");
// `<vault-path>` is substituted at install time (AGENTS.md); VAULT_DIR overrides it.
const VAULT_PATH = (Bun.env.VAULT_DIR ?? "<vault-path>").replace(/\/+$/, "");

const DEFAULT_MIN_TURNS = 6;
const DEFAULT_MIN_MINUTES = 45;
const TRIAL_DEFAULT_MIN_TURNS = 3;
const TRIAL_DEFAULT_MIN_MINUTES = 10;
const TRIAL_DEFAULT_DURATION_MINUTES = 24 * 60;

const FOLLOWUP_MESSAGE =
  `Run the \`obsidian-vault\` skill and execute \`/compress\` for this session now. ` +
  `Write the session diary entry (Summary / Work Items / Decisions / What Was New / Retrospective / Open Threads), ` +
  `append corrections and new-things registries when applicable, and update project \`CLAUDE.md\` Open Threads. ` +
  `Vault root: \`${VAULT_PATH}\`. ` +
  `Mine the current conversation transcript (and recent turns since the last compress) — capture user preferences, corrections, and durable patterns the user stated explicitly. ` +
  `Exclude secrets and one-off transient noise. ` +
  `If the session has no meaningful diary content yet, respond exactly: No vault diary updates.`;

interface StopHookInput {
  conversation_id: string;
  generation_id?: string;
  status: "completed" | "aborted" | "error" | string;
  loop_count: number;
  transcript_path?: string | null;
}

interface VaultCompressState {
  version: 1;
  lastRunAtMs: number;
  turnsSinceLastRun: number;
  lastTranscriptMtimeMs: number | null;
  lastProcessedGenerationId: string | null;
  trialStartedAtMs: number | null;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function readEnvValue(primary: string, legacy: string): string | undefined {
  return Bun.env[primary] ?? Bun.env[legacy];
}

function loadState(): VaultCompressState {
  const fallback: VaultCompressState = {
    version: 1,
    lastRunAtMs: 0,
    turnsSinceLastRun: 0,
    lastTranscriptMtimeMs: null,
    lastProcessedGenerationId: null,
    trialStartedAtMs: null,
  };

  if (!existsSync(STATE_PATH)) return fallback;

  try {
    const parsed = JSON.parse(readFileSync(STATE_PATH, "utf-8")) as Partial<VaultCompressState>;
    if (parsed.version !== 1) return fallback;
    return {
      version: 1,
      lastRunAtMs:
        typeof parsed.lastRunAtMs === "number" && Number.isFinite(parsed.lastRunAtMs)
          ? parsed.lastRunAtMs
          : 0,
      turnsSinceLastRun:
        typeof parsed.turnsSinceLastRun === "number" &&
        Number.isFinite(parsed.turnsSinceLastRun) &&
        parsed.turnsSinceLastRun >= 0
          ? parsed.turnsSinceLastRun
          : 0,
      lastTranscriptMtimeMs:
        typeof parsed.lastTranscriptMtimeMs === "number" &&
        Number.isFinite(parsed.lastTranscriptMtimeMs)
          ? parsed.lastTranscriptMtimeMs
          : null,
      lastProcessedGenerationId:
        typeof parsed.lastProcessedGenerationId === "string"
          ? parsed.lastProcessedGenerationId
          : null,
      trialStartedAtMs:
        typeof parsed.trialStartedAtMs === "number" && Number.isFinite(parsed.trialStartedAtMs)
          ? parsed.trialStartedAtMs
          : null,
    };
  } catch {
    return fallback;
  }
}

function saveState(state: VaultCompressState): void {
  const directory = dirname(STATE_PATH);
  if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}

function getTranscriptMtimeMs(transcriptPath: string | null | undefined): number | null {
  if (!transcriptPath) return null;
  try {
    return statSync(transcriptPath).mtimeMs;
  } catch {
    return null;
  }
}

function shouldCountTurn(input: StopHookInput): boolean {
  return input.status === "completed" && input.loop_count === 0;
}

async function parseHookInput<T>(): Promise<T> {
  const text = await stdin.text();
  return JSON.parse(text) as T;
}

async function main(): Promise<number> {
  try {
    const input = await parseHookInput<StopHookInput>();
    const state = loadState();

    if (input.generation_id && input.generation_id === state.lastProcessedGenerationId) {
      console.log(JSON.stringify({}));
      return 0;
    }
    state.lastProcessedGenerationId = input.generation_id ?? null;

    const countedTurn = shouldCountTurn(input);
    const turnsSinceLastRun = state.turnsSinceLastRun + (countedTurn ? 1 : 0);
    const now = Date.now();

    const trialEnabled = parseBoolean(readEnvValue("VAULT_COMPRESS_TRIAL_MODE", "VAULT_COMPRESS_TRIAL"));
    if (trialEnabled && countedTurn && state.trialStartedAtMs === null) {
      state.trialStartedAtMs = now;
    }

    const trialDurationMinutes = parsePositiveInt(
      readEnvValue("VAULT_COMPRESS_TRIAL_DURATION_MINUTES", "VAULT_COMPRESS_TRIAL_DURATION_MINUTES"),
      TRIAL_DEFAULT_DURATION_MINUTES,
    );
    const trialMinTurns = parsePositiveInt(
      readEnvValue("VAULT_COMPRESS_TRIAL_MIN_TURNS", "VAULT_COMPRESS_TRIAL_MIN_TURNS"),
      TRIAL_DEFAULT_MIN_TURNS,
    );
    const trialMinMinutes = parsePositiveInt(
      readEnvValue("VAULT_COMPRESS_TRIAL_MIN_MINUTES", "VAULT_COMPRESS_TRIAL_MIN_MINUTES"),
      TRIAL_DEFAULT_MIN_MINUTES,
    );
    const inTrialWindow =
      trialEnabled &&
      state.trialStartedAtMs !== null &&
      now - state.trialStartedAtMs < trialDurationMinutes * 60_000;

    const minTurns = parsePositiveInt(
      readEnvValue("VAULT_COMPRESS_MIN_TURNS", "VAULT_COMPRESS_MIN_TURNS"),
      DEFAULT_MIN_TURNS,
    );
    const minMinutes = parsePositiveInt(
      readEnvValue("VAULT_COMPRESS_MIN_MINUTES", "VAULT_COMPRESS_MIN_MINUTES"),
      DEFAULT_MIN_MINUTES,
    );

    const effectiveMinTurns = inTrialWindow ? trialMinTurns : minTurns;
    const effectiveMinMinutes = inTrialWindow ? trialMinMinutes : minMinutes;
    // The first turn starts the clock: the gate needs both turns and minutes.
    if (state.lastRunAtMs <= 0) state.lastRunAtMs = now;
    const minutesSinceLastRun = Math.floor((now - state.lastRunAtMs) / 60000);
    const transcriptMtimeMs = getTranscriptMtimeMs(input.transcript_path);
    const hasTranscriptAdvanced =
      transcriptMtimeMs !== null &&
      (state.lastTranscriptMtimeMs === null || transcriptMtimeMs > state.lastTranscriptMtimeMs);

    const shouldTrigger =
      countedTurn &&
      turnsSinceLastRun >= effectiveMinTurns &&
      minutesSinceLastRun >= effectiveMinMinutes &&
      hasTranscriptAdvanced;

    if (shouldTrigger) {
      state.lastRunAtMs = now;
      state.turnsSinceLastRun = 0;
      state.lastTranscriptMtimeMs = transcriptMtimeMs;
      saveState(state);
      console.log(JSON.stringify({ followup_message: FOLLOWUP_MESSAGE }));
      return 0;
    }

    state.turnsSinceLastRun = turnsSinceLastRun;
    saveState(state);
    console.log(JSON.stringify({}));
    return 0;
  } catch (error) {
    console.error("[vault-compress-stop] failed", error);
    console.log(JSON.stringify({}));
    return 0;
  }
}

await main();
