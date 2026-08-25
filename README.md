# Ledger — Subscription & Renewal Dashboard

A personal finance dashboard for tracking recurring SaaS and streaming subscriptions: monthly burn rate, upcoming renewals, and active/paused state — all in the browser, no backend required.

## Features

- **Entry form** — add a service name, cost, billing cycle (monthly/yearly), and next renewal date via a native calendar date-picker.
- **Burn gauge** — a live fuel-gauge visualization of your total monthly burn rate against a configurable ceiling, normalizing yearly plans down to a monthly rate.
- **Renewals alert card** — counts subscriptions renewing within 7 days and lists them by name.
- **Manifest table** — every subscription in one sortable-by-urgency table. Rows renewing within 7 days get an amber "Renewing soon" badge and a left-edge highlight.
- **Active / Paused toggle** — pausing a subscription instantly greys out its row and removes its cost from the burn rate metric (a live "what if I cancelled this" simulation), without deleting the record. A separate readout shows total monthly savings from paused items.
- **Local persistence** — subscriptions and your burn ceiling are saved to `localStorage`, so your data survives a page refresh.
- **Auto-renewal rollover** — on load, any active subscription whose renewal date has passed is automatically advanced to its next future billing date (one cycle at a time, so it also catches up correctly if you haven't opened the app in a while). Rolled-forward items get an "Auto-renewed" tag and a summary banner above the table. Paused subscriptions are left alone, since nothing is being billed.

## Tech

Plain HTML/CSS/JS — no build step, no dependencies, no framework. Fonts are pulled from Google Fonts (IBM Plex Mono + Inter); everything else is self-contained.

## Running it locally

Just open `index.html` in a browser. For a nicer local dev loop (so relative paths and fonts behave exactly like production), serve it with any static file server, e.g.:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then visit the printed URL.

## Deploying with GitHub Pages

1. Push this repo to GitHub (see below).
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to `Deploy from a branch`, branch `main`, folder `/ (root)`.
4. Save — your dashboard will be live at `https://<your-username>.github.io/<repo-name>/` within a minute or two.

## Pushing this project to your existing repo

From inside this project folder:

```bash
git init
git add .
git commit -m "Initial commit: subscription tracker dashboard"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

(Skip `git remote add origin` if it's already configured, and use `git push` instead.)

## How the core logic works

- **Cost Uniformity Engine** (`toMonthlyRate` in `app.js`): yearly costs are divided by 12; monthly costs pass through unchanged. This is what the burn-rate metric is built from.
- **Date Intersect Calculator** (`daysUntil` / `isRenewingSoon` in `app.js`): parses the `YYYY-MM-DD` renewal string as a local calendar date, diffs it against "today" in whole days, and flags anything active with `0–7` days remaining as "Renewing soon".
- **Pause simulation**: pausing sets `active: false` on that record only — it stays in the array (and in `localStorage`), the table row greys out via a CSS class, and every metric recomputation filters on `active` before summing, so the burn rate updates in real time.
- **Renewal Rollover Engine** (`rollForwardLapsedRenewals` in `app.js`): runs once on page load. For each active subscription whose renewal date is in the past, it repeatedly adds one billing cycle (+1 month or +12 months) until the date is today or later — so it correctly catches up a subscription even if the app hasn't been opened for several cycles. Paused subscriptions are skipped, since nothing is being billed while paused.

## Known edge case

Month-end dates can drift slightly across February: e.g. a monthly subscription renewing on the 31st gets clamped to Feb 28 (or 29), and every month after that clamps to the 28th until a month with 31 days resets it. This is standard calendar-math behavior (the same thing your bank or a real billing system does), not a bug, but worth knowing if you're tracking a subscription that bills on the 29th–31st.

## Notes / possible next steps

- Currency is fixed to USD for the demo; swapping the `Intl.NumberFormat` locale/currency in `app.js` would generalize it.
- Data is local to one browser — there's no account system or server sync.
