import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_IDEA_LENGTH, MODEL, PitchError, SessionSchema, runBoard } from "./board.ts";
import type { Session } from "./board.ts";
import { cardPng, esc } from "./card.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, "..", "public");
const dataDir = process.env.BOARDROOM_DATA_DIR || path.join(here, "..", "data");

const PORT = Number(process.env.PORT || 3000);
const PER_IP_LIMIT = Number(process.env.BOARDROOM_PER_IP_LIMIT || 5); // pitches per window
const WINDOW_MS = Number(process.env.BOARDROOM_WINDOW_MINUTES || 10) * 60_000;
const DAILY_CAP = Number(process.env.BOARDROOM_DAILY_CAP || 500); // hard ceiling on paid model calls per day
const TRUST_PROXY = process.env.TRUST_PROXY === "1";

type Stored = { id: string; idea: string; created: string; session: Session };

const ID = /^[A-Za-z0-9_-]{8,16}$/;

async function save(idea: string, session: Session): Promise<Stored> {
  const stored: Stored = { id: randomBytes(6).toString("base64url"), idea, created: new Date().toISOString(), session };
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, `${stored.id}.json`), JSON.stringify(stored));
  return stored;
}

async function load(id: string): Promise<Stored | null> {
  if (!ID.test(id)) return null;
  try {
    const raw = JSON.parse(await readFile(path.join(dataDir, `${id}.json`), "utf8"));
    const session = SessionSchema.safeParse(raw.session);
    return session.success ? { ...raw, session: session.data } : null;
  } catch {
    return null;
  }
}

// --- Spend guards -----------------------------------------------------------

const hits = new Map<string, number[]>();
let day = "";
let dayCount = 0;

function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (TRUST_PROXY && typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

function allow(ip: string): { ok: true } | { ok: false; message: string } {
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    dayCount = 0;
  }
  if (dayCount >= DAILY_CAP) return { ok: false, message: "The board has heard enough pitches for today. Come back tomorrow." };
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= PER_IP_LIMIT) {
    hits.set(ip, recent);
    return { ok: false, message: "You're pitching too fast. Give the board a few minutes." };
  }
  recent.push(now);
  hits.set(ip, recent);
  dayCount++;
  return { ok: true };
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of hits) if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(ip);
}, 60_000).unref();

// --- HTTP helpers -----------------------------------------------------------

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};

function send(res: ServerResponse, status: number, body: string | Buffer, type = "text/plain; charset=utf-8", extra: Record<string, string> = {}) {
  res.writeHead(status, { "Content-Type": type, "X-Content-Type-Options": "nosniff", ...extra });
  res.end(body);
}

function origin(req: IncomingMessage): string {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const proto = TRUST_PROXY && req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
  return `${proto}://${req.headers.host || `localhost:${PORT}`}`;
}

async function readJson(req: IncomingMessage, limit = 4096): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new PitchError("Request too large.", 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new PitchError("Invalid JSON.", 400);
  }
}

// JSON that is safe to embed inside a <script> tag.
const LINE_SEPARATORS = new RegExp("[\\u2028\\u2029]", "g");
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c").replace(LINE_SEPARATORS, "");

async function page(req: IncomingMessage, stored: Stored | null): Promise<string> {
  const html = await readFile(path.join(publicDir, "index.html"), "utf8");
  const base = origin(req);
  let title = "The AI Boardroom — pitch your startup idea to a brutal AI board";
  let description = "One sentence in. Four AI executives argue about it. You get a verdict worth sharing.";
  let image = "";
  let url = base;
  if (stored) {
    const v = stored.session.verdict;
    title = `${stored.session.company_name}: ${v.decision} at ${v.valuation} — The AI Boardroom`;
    description = `Fatal flaw: ${v.fatal_flaw}`;
    image = `${base}/v/${stored.id}/card.png`;
    url = `${base}/v/${stored.id}`;
  }
  const meta = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:type" content="website">`,
    image && `<meta property="og:image" content="${esc(image)}">`,
    image && `<meta property="og:image:width" content="1200">`,
    image && `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">`,
  ]
    .filter(Boolean)
    .join("\n    ");
  const data = `<script>window.__BOARDROOM__=${scriptJson({ stored, maxIdeaLength: MAX_IDEA_LENGTH })}</script>`;
  return html.replace("<!--META-->", meta).replace("<!--DATA-->", data);
}

// --- Routes -----------------------------------------------------------------

async function handlePitch(req: IncomingMessage, res: ServerResponse) {
  const body = await readJson(req);
  const raw = typeof body === "object" && body !== null && "idea" in body ? (body as { idea: unknown }).idea : undefined;
  const idea = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (idea.length < 8) throw new PitchError("Give the board at least a sentence to work with.", 400);
  if (idea.length > MAX_IDEA_LENGTH) throw new PitchError(`Keep the pitch under ${MAX_IDEA_LENGTH} characters.`, 400);

  const gate = allow(clientIp(req));
  if (!gate.ok) throw new PitchError(gate.message, 429);

  // The response is newline-delimited JSON: {type:"line"} per debate line, then
  // one {type:"verdict"} or {type:"error"}.
  res.writeHead(200, { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
  const emit = (event: object) => res.write(JSON.stringify(event) + "\n");

  const abort = new AbortController();
  res.on("close", () => abort.abort());

  try {
    const session = await runBoard(idea, (line) => emit({ type: "line", ...line }), abort.signal);
    const stored = await save(idea, session);
    emit({ type: "verdict", stored });
  } catch (err) {
    if (!(err instanceof PitchError)) console.error(err);
    emit({ type: "error", message: err instanceof PitchError ? err.message : "Something went wrong. Try again." });
  }
  res.end();
}

async function route(req: IncomingMessage, res: ServerResponse) {
  const { pathname } = new URL(req.url || "/", "http://localhost");

  if (req.method === "POST" && pathname === "/api/pitch") return handlePitch(req, res);
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");

  if (pathname === "/healthz") return send(res, 200, "ok");
  if (pathname === "/") return send(res, 200, await page(req, null), TYPES[".html"]);

  const share = pathname.match(/^\/v\/([^/]+)(\/card\.png)?$/);
  if (share) {
    const stored = await load(share[1]);
    if (!stored) return send(res, 404, "No such verdict.");
    if (share[2]) {
      const host = new URL(origin(req)).host;
      return send(res, 200, cardPng(stored.session, host), "image/png", { "Cache-Control": "public, max-age=86400" });
    }
    return send(res, 200, await page(req, stored), TYPES[".html"]);
  }

  // Static files: only flat names from public/, never index.html (it needs templating).
  const name = pathname.slice(1);
  if (/^[a-z0-9-]+\.(js|css|svg)$/.test(name)) {
    try {
      return send(res, 200, await readFile(path.join(publicDir, name)), TYPES[path.extname(name)]);
    } catch {
      /* fall through to 404 */
    }
  }
  send(res, 404, "Not found");
}

export const server = http.createServer((req, res) => {
  route(req, res).catch((err) => {
    if (!(err instanceof PitchError)) console.error(err);
    if (res.headersSent) return res.end();
    const status = err instanceof PitchError ? err.status : 500;
    send(res, status, JSON.stringify({ message: err instanceof PitchError ? err.message : "Server error." }), "application/json");
  });
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => {
    const mode = process.env.BOARDROOM_MOCK === "1" ? "mock mode (no API calls)" : `model ${MODEL}`;
    console.log(`AI Boardroom listening on http://localhost:${PORT} — ${mode}`);
  });
}
