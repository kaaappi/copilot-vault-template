import { GoogleGenAI } from "@google/genai";
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { basename, join, relative } from "path";
import { createHash } from "crypto";

// ── Configure via environment variables ──────────────────────
const VAULT_DIR = process.env.VAULT_DIR;
if (!VAULT_DIR) {
  console.error("VAULT_DIR environment variable is required");
  process.exit(1);
}
if (!process.env.GOOGLE_API_KEY) {
  console.error("GOOGLE_API_KEY environment variable is required");
  process.exit(1);
}
const INDEX_FILE = new URL("./vectors.json", import.meta.url).pathname;
const MODEL = "gemini-embedding-2-preview";

// Folders to skip during indexing — the server never returns them, so
// embedding them only burns API quota.
// Matches an optional numeric prefix too (e.g. "07-sources"), so this works
// whether your vault uses plain or Karpathy-style numbered folders.
const SKIP_DIRS = [
  /^_templates$/,
  /^(\d+-)?sources$/,
  /^(\d+-)?session-diary$/,
  /^node_modules$/,
];
// How much of the note body goes into the embedding, after title/aliases/summary.
const BODY_CHARS = 2000;
// ─────────────────────────────────────────────────────────────

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

const collectFiles = (dir) => {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith(".") || SKIP_DIRS.some((p) => p.test(entry.name))) continue;
      results.push(...collectFiles(full));
    } else if (entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
};

const unquote = (s) => s.trim().replace(/^["']|["']$/g, "");

const extractContent = (filePath) => {
  const raw = readFileSync(filePath, "utf-8");
  const summaryMatch = raw.match(/^summary:\s*(.+)$/m);
  const titleMatch = raw.match(/^title:\s*(.+)$/m);
  const aliasesMatch = raw.match(/aliases:\n((?:\s+-\s+.+\n)+)/);

  const summary = summaryMatch ? unquote(summaryMatch[1]) : "";
  const title = titleMatch ? unquote(titleMatch[1]) : basename(filePath, ".md");
  const aliases = aliasesMatch
    ? aliasesMatch[1].split("\n").map((l) => unquote(l.replace(/^\s+-\s+/, ""))).filter(Boolean)
    : [];

  const body = raw.replace(/^---[\s\S]*?---\n*/, "").slice(0, BODY_CHARS);
  return {
    title,
    aliases,
    summary,
    content: `${title}\n${aliases.join(", ")}\n${summary}\n\n${body}`,
  };
};

const main = async () => {
  const files = collectFiles(VAULT_DIR);
  console.log(`Found ${files.length} files to index`);

  let existing = {};
  try { existing = JSON.parse(readFileSync(INDEX_FILE, "utf-8")); } catch {}

  const index = {};
  const toEmbed = [];

  for (const file of files) {
    const relPath = relative(VAULT_DIR, file);
    const { title, aliases, summary, content } = extractContent(file);
    const contentHash = createHash("sha1").update(content).digest("hex");

    if (existing[relPath]?.hash === contentHash) {
      // Same text, same vector — only refresh the metadata the server reads.
      index[relPath] = { ...existing[relPath], title, aliases, summary: summary || title };
      continue;
    }
    toEmbed.push({ relPath, title, aliases, summary, content, contentHash });
  }

  console.log(`${Object.keys(index).length} unchanged, ${toEmbed.length} to embed`);

  const BATCH_SIZE = 10;
  const DELAY_MS = 2000;

  for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + BATCH_SIZE);
    console.log(`Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(toEmbed.length / BATCH_SIZE)}...`);

    let result;
    for (let retry = 0; retry < 5; retry++) {
      try {
        // One Content object per note. A bare string array is merged into a single
        // multi-part Content by newer @google/genai versions → one vector per batch.
        result = await ai.models.embedContent({
          model: MODEL,
          contents: batch.map((b) => ({ parts: [{ text: b.content }] })),
        });
        break;
      } catch (e) {
        if (e.status === 429 && retry < 4) {
          const wait = (retry + 1) * 15;
          console.log(`  Rate limited, waiting ${wait}s...`);
          await new Promise((r) => setTimeout(r, wait * 1000));
        } else throw e;
      }
    }

    if (result?.embeddings?.length !== batch.length) {
      throw new Error(`Expected ${batch.length} embeddings, got ${result?.embeddings?.length ?? 0} — check the model and @google/genai version`);
    }

    for (let j = 0; j < batch.length; j++) {
      const { relPath, title, aliases, summary, contentHash } = batch[j];
      index[relPath] = {
        hash: contentHash,
        vector: result.embeddings[j].values,
        title,
        aliases,
        summary: summary || title,
      };
    }

    writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
    if (i + BATCH_SIZE < toEmbed.length) await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
  console.log(`\n✓ Index saved: ${Object.keys(index).length} files`);
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
