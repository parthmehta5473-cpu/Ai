import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

process.env.BOARDROOM_DATA_DIR = mkdtempSync(path.join(tmpdir(), "boardroom-"));
process.env.BOARDROOM_PER_IP_LIMIT = "3";

const { extractLines, normalize } = await import("../src/board.ts");
const { server } = await import("../src/server.ts");

let base = "";
before(async () => {
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

const pitch = (idea: unknown) =>
  fetch(`${base}/api/pitch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idea }) });

test("extractLines yields only completed entries, once each", () => {
  const full = '{"valid_pitch":true,"company_name":"X","debate":[{"speaker":"CEO","line":"He said \\"go\\"."},{"speaker": "CFO", "line": "No."}],"verdict":{"best_quote":"q","quote_speaker":"CFO"}}';
  const seen: string[] = [];
  let cursor = 0;
  for (let i = 1; i <= full.length; i++) {
    const found = extractLines(full.slice(0, i), cursor);
    cursor = found.next;
    seen.push(...found.lines.map((l) => `${l.speaker}:${l.line}`));
  }
  assert.deepEqual(seen, ['CEO:He said "go".', "CFO:No."]);
});

test("normalize clamps the score to a whole number in 0-100", () => {
  const verdict = { decision: "PASS" as const, valuation: "$0", fatal_flaw: "", best_quote: "", quote_speaker: "CFO" as const, one_liner: "" };
  const make = (score: number) => normalize({ valid_pitch: true, company_name: "", debate: [], verdict: { ...verdict, score } }).verdict.score;
  assert.equal(make(140), 100);
  assert.equal(make(-3), 0);
  assert.equal(make(41.6), 42);
});

test("a pitch streams the debate, then a verdict that has a share page and card", async () => {
  const idea = 'A <script>alert(1)</script> marketplace for "used" umbrellas';
  const res = await pitch(idea);
  assert.equal(res.status, 200);
  const events = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(events.at(-1).type, "verdict");
  assert.equal(events.filter((e) => e.type === "line").length, 7);
  const { id } = events.at(-1).stored;

  const page = await fetch(`${base}/v/${id}`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, new RegExp(`og:image" content="${base}/v/${id}/card.png"`));
  assert.ok(!html.includes("<script>alert(1)</script>"), "user text must not be injected as markup");

  const card = await fetch(`${base}/v/${id}/card.png`);
  assert.equal(card.headers.get("content-type"), "image/png");
  const png = Buffer.from(await card.arrayBuffer());
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});

test("bad input and unknown ids are rejected", async () => {
  assert.equal((await pitch("short")).status, 400);
  assert.equal((await pitch("x".repeat(400))).status, 400);
  assert.equal((await pitch(42)).status, 400);
  assert.equal((await fetch(`${base}/v/nope1234`)).status, 404);
  assert.equal((await fetch(`${base}/v/..%2F..%2Fpackage/card.png`)).status, 404);
  assert.equal((await fetch(`${base}/index.html`)).status, 404);
});

test("the per-IP limit returns 429 once exceeded", async () => {
  const statuses: number[] = [];
  for (let i = 0; i < 4; i++) {
    const res = await pitch("An app that reminds you to cancel free trials");
    await res.text();
    statuses.push(res.status);
  }
  assert.ok(statuses.includes(429), `expected a 429 in ${statuses}`);
});
