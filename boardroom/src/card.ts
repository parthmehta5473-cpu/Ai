import { Resvg } from "@resvg/resvg-js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Session } from "./board.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const fontDir = path.join(here, "..", "assets", "fonts");
const fontFiles = ["Inter_400Regular.ttf", "Inter_700Bold.ttf", "Inter_900Black.ttf"].map((f) => path.join(fontDir, f));

const COLORS = { FUNDED: "#34d399", PIVOT: "#fbbf24", PASS: "#f87171" } as const;

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// Greedy wrap by estimated width. Inter averages roughly 0.52em per character
// at regular weight; that is close enough for a card with generous margins.
function wrap(text: string, fontSize: number, maxWidth: number, maxLines: number, em = 0.52): string[] {
  const perLine = Math.max(8, Math.floor(maxWidth / (fontSize * em)));
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= perLine) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word.length > perLine ? word.slice(0, perLine - 1) + "…" : word;
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, perLine - 1).trimEnd() + "…";
  }
  return lines;
}

function tspans(lines: string[], x: number, lineHeight: number): string {
  return lines.map((l, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}">${esc(l)}</tspan>`).join("");
}

export function cardSvg(session: Session, site: string): string {
  const v = session.verdict;
  const color = COLORS[v.decision];
  const name = wrap(session.company_name, 64, 640, 1, 0.58);
  const idea = wrap(v.one_liner, 26, 640, 2);
  const flaw = wrap(v.fatal_flaw, 28, 1000, 2);
  const quote = wrap(`“${v.best_quote}”`, 30, 1000, 3);
  const quoteY = 462;
  const attributionY = quoteY + (quote.length - 1) * 40 + 44;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="Inter">
  <rect width="1200" height="630" fill="#0b0d12"/>
  <rect x="0" y="0" width="1200" height="8" fill="${color}"/>
  <text x="80" y="92" font-size="22" font-weight="700" fill="#8b93a7" letter-spacing="4">THE AI BOARDROOM</text>
  <text x="80" y="176" font-size="64" font-weight="900" fill="#f4f6fb">${esc(name[0] ?? "")}</text>
  <text x="80" y="222" font-size="26" fill="#aab2c5">${tspans(idea, 80, 34)}</text>

  <g transform="rotate(-6 960 150)">
    <rect x="800" y="100" width="320" height="100" rx="12" fill="none" stroke="${color}" stroke-width="6"/>
    <text x="960" y="170" font-size="60" font-weight="900" fill="${color}" text-anchor="middle" letter-spacing="3">${v.decision}</text>
  </g>
  <text x="1120" y="262" font-size="26" font-weight="700" fill="#aab2c5" text-anchor="end">${esc(v.valuation)} valuation · ${v.score}/100</text>

  <text x="80" y="330" font-size="20" font-weight="700" fill="${color}" letter-spacing="3">FATAL FLAW</text>
  <text x="80" y="370" font-size="28" font-weight="700" fill="#f4f6fb">${tspans(flaw, 80, 38)}</text>

  <text x="80" y="${quoteY}" font-size="30" fill="#d7dcea">${tspans(quote, 80, 40)}</text>
  <text x="80" y="${attributionY}" font-size="22" font-weight="700" fill="#8b93a7">— the ${esc(v.quote_speaker)}</text>

  <text x="1120" y="590" font-size="22" font-weight="700" fill="#8b93a7" text-anchor="end">Pitch yours at ${esc(site)}</text>
</svg>`;
}

export function cardPng(session: Session, site: string): Buffer {
  const resvg = new Resvg(cardSvg(session, site), {
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: "Inter" },
    fitTo: { mode: "width", value: 1200 },
  });
  return resvg.render().asPng();
}
