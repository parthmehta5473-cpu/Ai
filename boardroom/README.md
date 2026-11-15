# The AI Boardroom

Pitch a startup idea in one sentence. Four AI executives (CEO, CFO, CTO, investor) argue about it live, then issue a verdict card built for sharing: decision, fictional valuation, score, fatal flaw and the best quote.

## Run it

Requires Node 22.18 or newer (TypeScript runs directly, there is no build step).

```bash
npm install
npm run dev:mock        # canned debate, no API key, no cost
```

For real verdicts, set an Anthropic API key and start the server:

```bash
export ANTHROPIC_API_KEY=...
export PUBLIC_URL=https://your-domain.example   # used in share links and on the card
npm start
```

Open http://localhost:3000. All settings are listed in `.env.example`.

## How it works

- `src/board.ts` makes one streaming Claude call per pitch. The response is structured JSON (debate, then verdict); debate lines are forwarded to the browser as each one completes.
- `src/server.ts` is a dependency-free Node HTTP server: `POST /api/pitch` streams newline-delimited JSON, `/v/:id` is the share page with Open Graph tags, `/v/:id/card.png` is the card image.
- `src/card.ts` renders the 1200x630 card as SVG and rasterises it with resvg using the bundled Inter font.
- `public/` holds the page, styles and client script.

## Cost and abuse guards

Every pitch is a paid model call, so the server limits them:

- 5 pitches per IP per 10 minutes (`BOARDROOM_PER_IP_LIMIT`, `BOARDROOM_WINDOW_MINUTES`).
- 500 pitches per day in total (`BOARDROOM_DAILY_CAP`). Raise this deliberately; it is the ceiling on your daily bill.
- Pitches are capped at 280 characters and treated as untrusted text; the model is told to reject anything that is not a business idea.

The default model is `claude-opus-5-5`. Set `BOARDROOM_MODEL` to a cheaper model to cut cost per pitch.

## Known limits

- Verdicts are stored as JSON files in `data/`. On a host with an ephemeral disk, share links break on redeploy; move storage to a database before launch.
- Rate limits are in memory, so they reset on restart and are per process.
- Set `TRUST_PROXY=1` only behind a reverse proxy that sets `X-Forwarded-For`, otherwise the per-IP limit can be spoofed.

## Tests

```bash
npm test          # runs against mock mode
npm run typecheck
```

The Inter font in `assets/fonts` is licensed under the SIL Open Font License (`assets/fonts/OFL.txt`).
