# Style Analysis

Personal color & style analysis web app. Anyone can upload a portrait, get a 12-season analysis with palette, hair recommendations, and (optionally) makeup. Past analyses persist per browser so multiple people sharing a device can keep their own results.

## Run locally

```bash
npm install
npm run server     # API on :3001
npm run dev        # Frontend on :5173 (also boots the server via concurrently)
```

Open http://localhost:5173.

The API uses the `claude` CLI (`--print` mode) to call Claude with vision; make sure you've authenticated it first (`claude config set apiKey ...`).

## Architecture

- `src/` — React + Vite frontend. State is purely client-side; analyses persist in `localStorage`.
- `server.ts` — Express API. Stateless: it forwards uploaded photos to the Claude CLI, parses the JSON it returns, and echoes it back. Photos are written to a tmp file for the CLI to read and deleted immediately after.
- `tests/e2e.ts` — End-to-end test that exercises both `includeMakeup=true` and `includeMakeup=false` branches, validates the schema, and verifies the `name` round-trip and the structural invariant that `makeup` is absent when opted out.

## Multi-user model

Each browser keeps its own list of analyses (capped at 30). There is no server-side user store — the analysis API is stateless. If you want shared/cross-device persistence, that's a future addition (would need auth + a database).

## Run the e2e tests

```bash
npm run server &                          # API must be running
npm run test:e2e -- ./path/to/portrait.jpg
```

Two cases run back-to-back: full analysis (with makeup) and no-makeup analysis. Pass requires schema validity, name round-trip, and correct presence/absence of the makeup field.

## Tech

React 19 · Vite 8 · TypeScript 6 · Tailwind 4 · Express 5 · html-to-image (client-side card export)
