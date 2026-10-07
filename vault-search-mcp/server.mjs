import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { GoogleGenAI } from "@google/genai";
import { readFileSync, watchFile } from "fs";
import { basename, relative, resolve, sep } from "path";

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

// Folders excluded from search results.
// Matches an optional numeric prefix too (e.g. "06-session-diary/"),
// so this works whether your vault uses plain or Karpathy-style numbered folders.
const EXCLUDED_PREFIXES = [
  /^(\d+-)?session-diary\//,
  /^(\d+-)?sources\//,
  /^_templates\//,
];
// ─────────────────────────────────────────────────────────────

let index = {};
let titleAliasCache = {};

const loadIndex = () => {
  try {
    const raw = JSON.parse(readFileSync(INDEX_FILE, "utf-8"));
    const newIndex = {};
    for (const [path, data] of Object.entries(raw)) {
      if (!EXCLUDED_PREFIXES.some((p) => p.test(path))) {
        newIndex[path] = data;
      }
    }
    index = newIndex;

    const newCache = {};
    for (const [path, data] of Object.entries(index)) {
      const title = data.title || basename(path, ".md");
      newCache[path] = [title, ...(data.aliases || [])].map((n) => n.trim().toLowerCase());
    }
    titleAliasCache = newCache;
    console.error(`[vault-search] loaded ${Object.keys(index).length} entries`);
  } catch (e) {
    console.error("No vectors.json found. Run: npm run index");
  }
};

loadIndex();
watchFile(INDEX_FILE, { interval: 5000 }, () => {
  console.error("[vault-search] vectors.json changed, reloading...");
  loadIndex();
});

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

const search = async (query, topK = 3) => {
  const result = await ai.models.embedContent({
    model: MODEL,
    contents: [query],
  });
  const queryVec = result.embeddings[0].values;
  const queryLower = query.toLowerCase();

  return Object.entries(index)
    .map(([path, data]) => {
      const base = cosine(queryVec, data.vector);
      const boost = titleBoost(path, queryLower);
      return { path, score: Math.min(base + boost, 1.0), boost };
    })
    .filter((r) => r.score >= 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
};

const server = new Server(
  { name: "vault-search", version: "1.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search",
      description:
        "Semantic search across the Obsidian knowledge vault. " +
        "Returns top 3 matches ranked by similarity (60%+ threshold). " +
        "Use English keywords for best results.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
        },
        required: ["query"],
      },
    },
    {
      name: "get",
      description: "Read a vault file by relative path",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative path from vault root" },
        },
        required: ["path"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "search") {
    const results = await search(args.query);
    const text = results.length
      ? results
          .map(
            (r, i) =>
              `${i + 1}. [${Math.round(r.score * 100)}%] ${r.path}` +
              (r.boost > 0 ? ` (title match +${Math.round(r.boost * 100)}%)` : "")
          )
          .join("\n")
      : "No results above 60% threshold.";
    return { content: [{ type: "text", text }] };
  }

  if (name === "get") {
    // Never read outside the vault, whatever path the model sends.
    const vaultRoot = resolve(VAULT_DIR);
    const target = resolve(vaultRoot, String(args.path ?? ""));
    const rel = relative(vaultRoot, target);
    if (!rel || rel === ".." || rel.startsWith(`..${sep}`)) {
      return { content: [{ type: "text", text: `Path is outside the vault: ${args.path}` }], isError: true };
    }
    try {
      const content = readFileSync(target, "utf-8");
      return { content: [{ type: "text", text: content }] };
    } catch {
      return { content: [{ type: "text", text: `File not found: ${args.path}` }], isError: true };
    }
  }

  return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
});

const transport = new StdioServerTransport();
await server.connect(transport);
