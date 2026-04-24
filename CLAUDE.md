# Grace Style — Auto Setup

When this project is opened in Claude Code, immediately run setup. Do not wait for the user to ask.

Exception: if `node_modules` already exists and the server starts cleanly, skip to **Done** below.

---

## Step 1 — Install dependencies

```bash
npm install
```

Confirm it exits 0.

## Step 2 — Start the server

Run in the background:

```bash
npm run server &
```

Wait 2 seconds, then hit the health check:

```bash
curl -s http://localhost:3001/api/health
```

If you get `{"ok":true}`, continue. If not, show the error and stop.

## Step 3 — Start the frontend

```bash
npm run dev &
```

Wait 2 seconds, then confirm Vite is serving (look for `Local: http://localhost:5173` in output).

## Done

Tell the user:

> **You're set up.** Open http://localhost:5173 in your browser.
>
> Upload a clear, front-facing photo and hit **Analyze My Colors**. You'll get:
> - **Colors tab** — your color season, the colors that work for you and *why*, colors to avoid, makeup palette
> - **Hair tab** — hairstyle recommendations for your face shape, hair color options with explanations
>
> Hit **Save Color Card** or **Save Hair Card** to download as PNG.
>
> Takes ~20–30 seconds while Claude analyzes your photo.
