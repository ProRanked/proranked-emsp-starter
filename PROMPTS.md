# Prompts — build your driver app with an AI agent

Copy a prompt, paste it into **Claude Code** (or Cursor / any coding agent) inside this repo, and
edit the bracketed bits. Every prompt assumes you've already done the [README](./README.md)
quickstart, so `.env` has a working `pr_pk_` key.

> **Claude Code, not chat artifacts.** Artifacts run under a strict content-security policy that
> blocks calls to `api.proranked.com`, so an artifact can only mock this API. Use artifacts to
> explore a *look*; use Claude Code to build the real thing.

---

## 1 · Re-brand this app as your own

The highest-value first move — you get a complete, working driver app in your colours.

```
Re-brand this app from "Voltway" to [YOUR BRAND].

Brand: [YOUR BRAND]
Primary colour: [#HEX]   Accent: [#HEX]
Feel: [e.g. clean and technical / warm and friendly]

Do it via the design tokens and branding components, not by editing colours screen by
screen — read CLAUDE.md first for where those live. Replace the wordmark/logo, the app
title, and any Voltway copy. Keep every API call and screen behaviour exactly as-is.

When you're done, run the dev server and tell me which files I should look at to tweak
the look further.
```

## 2 · Add a screen

```
Add a [DESCRIBE THE SCREEN, e.g. "charging history screen showing past sessions with
kWh, cost and duration"] to this app.

Use the existing typed client in src/lib/phevnix.ts — find the method that already
covers this; only add one if the endpoint genuinely isn't there (check the OpenAPI
spec before you do, and tell me if it's missing).

Match the existing screens in src/screens/ for layout, loading and error states.
Remember driver-scoped reads need the driver JWT as well as the API key — CLAUDE.md
explains the two-part auth rule.
```

## 3 · Wire the full charging flow

The end-to-end journey, and the one with the most sharp edges.

```
Implement the complete charging journey in this app: pick a connector, start a session,
show live progress, then stop and show a summary.

Endpoints (they exist — don't invent others):
  POST /emsp/v1/charging/start   { chargerId, connectorNumber, idTag }
  GET  /emsp/v1/charging/sessions/{id}
  POST /emsp/v1/charging/stop    { sessionId }
  GET  /emsp/v1/events/stream    (SSE — live session/charger events)

Critical:
- start/stop need BOTH X-API-Key AND Authorization: Bearer <driver JWT>. Sign the driver
  in first. A key-only request returns 403 — I've verified this.
- start can return 402 Payment Required. Show "add a payment method"; do not retry.
- Poll the session endpoint, or subscribe to the SSE stream, for live kWh.

Handle the unhappy paths visibly rather than silently swallowing them.
```

## 4 · Take it to production

```
Get this app production-ready for [YOUR BRAND].

- Move the API key out of the client bundle if we ever need a secret key (right now we
  use a publishable pr_pk_ key, which is browser-safe by design — confirm that's still
  true for everything we call).
- Add proper error and empty states: a brand-new ProRanked network legitimately returns
  empty lists, and today that's indistinguishable from a failure.
- Check the build, fix TypeScript errors, and list anything you think is unsafe to ship.

Don't add analytics or third-party scripts without asking.
```

---

## Writing your own prompts

What makes these work (and what to keep if you write your own):

- **Name the exact endpoints.** Agents invent plausible-but-wrong paths when guessing.
- **Say "don't mock."** Left unsaid, a blocked agent will fake data to appear finished.
- **Point at `CLAUDE.md` and the OpenAPI spec** rather than re-explaining the API.
- **Say what a success looks like**, so the agent can check itself.
