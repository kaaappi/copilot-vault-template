// eval.mjs — Test search accuracy against your own vault content.
// Usage: GOOGLE_API_KEY=... node eval.mjs
//
// Copy this to eval.mjs and replace `tests` below with queries that match
// real node titles in your vault. This is also a good smoke test that the
// MCP server's index is built and the embedding API key works end-to-end.

import { GoogleGenAI } from "@google/genai";
import { readFileSync } from "fs";
import { basename } from "path";

const INDEX_FILE = new URL("./vectors.json", import.meta.url).pathname;
const MODEL = "gemini-embedding-2-preview";

const EXCLUDED_PREFIXES = [/^(\d+-)?session-diary\//, /^_templates\//];

if (!process.env.GOOGLE_API_KEY) {
  console.error("GOOGLE_API_KEY environment variable is required");
  process.exit(1);
}

let raw;
try {
  raw = JSON.parse(readFileSync(INDEX_FILE, "utf-8"));
} catch {
  console.error(`No vectors.json found at ${INDEX_FILE} — run 'npm run index' first.`);
  process.exit(1);
}
const index = {};
for (const [path, data] of Object.entries(raw)) {
  if (!EXCLUDED_PREFIXES.some((p) => p.test(path))) {
    index[path] = data;
  }
}

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

const cosine = (a, b) => {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

// Title/alias boost (same logic as server.mjs)
const titleAliasCache = {};
for (const [path, data] of Object.entries(index)) {
  const title = data.title || basename(path, ".md");
  titleAliasCache[path] = [title, ...(data.aliases || [])].map((n) => n.trim().toLowerCase());
}

const titleBoost = (path, queryLower) => {
  const names = titleAliasCache[path] || [];
  const queryWords = queryLower.split(/\s+/);
  for (const name of names) {
    if (!name) continue;
    if (name === queryLower || name.includes(queryLower)) return 0.12;
    if (queryWords.some((w) => w.length > 2 && name.includes(w))) return 0.06;
  }
  return 0;
};

// Replace with queries + expected-title substrings from YOUR vault.
const tests = [
  { q: "example query matching a real node in your vault", expect: "Example Node Title" },
  { q: "another phrasing of the same concept", expect: "Example Node Title" },
];

const main = async () => {
  console.log(`Index: ${Object.keys(index).length} files (${Object.keys(raw).length - Object.keys(index).length} excluded)`);
  console.log(`Running ${tests.length} queries...\n`);

  let hits = 0;
  const times = [];

  for (const { q, expect } of tests) {
    const start = performance.now();

    const result = await ai.models.embedContent({ model: MODEL, contents: [q] });
    const queryVec = result.embeddings[0].values;
    const queryLower = q.toLowerCase();

    const scores = Object.entries(index)
      .map(([path, data]) => {
        const base = cosine(queryVec, data.vector);
        const boost = titleBoost(path, queryLower);
        return { path, score: Math.min(base + boost, 1.0), base, boost };
      })
      .filter((r) => r.score >= 0.6)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const elapsed = Math.round(performance.now() - start);
    times.push(elapsed);

    const top1 = scores[0];
    if (!top1) {
      console.log(`  MISS [<60%] ${elapsed}ms — "${q}"\n        no results above threshold\n        expected: *${expect}*`);
      continue;
    }

    const hit = top1.path.toLowerCase().includes(expect.toLowerCase());

    if (hit) {
      hits++;
      const boostStr = top1.boost > 0 ? ` +${Math.round(top1.boost * 100)}% boost` : "";
      console.log(`  HIT  [${Math.round(top1.score * 100)}%${boostStr}] ${elapsed}ms — "${q}" → ${top1.path}`);
    } else {
      console.log(`  MISS [${Math.round(top1.score * 100)}%] ${elapsed}ms — "${q}"\n        got: ${top1.path}\n        expected: *${expect}*`);
    }
  }

  const avgMs = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  console.log(`\n=== Precision: ${hits}/${tests.length} | Avg latency: ${avgMs}ms ===`);
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
