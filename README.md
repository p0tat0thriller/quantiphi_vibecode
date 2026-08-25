# Ledger — Subscription & Renewal Dashboard

Ledger is a fully client-side, zero-dependency personal finance dashboard designed to track recurring SaaS and streaming subscriptions. It provides a real-time view of your monthly burn rate, flags upcoming renewals, and allows you to simulate savings by "pausing" active services—all entirely within your browser.

---

## What the App Does

As subscriptions pile up, it becomes difficult to track how much you are spending monthly and when those charges will hit your account. Ledger solves this by:
* Centralizing all subscriptions into a single sorted manifest.
* Normalizing both monthly and yearly costs into a single "Monthly Burn Rate."
* Alerting you when a charge is going to hit within the next 7 days.
* Automatically rolling forward past-due subscriptions to their next billing cycle so your data is never stale.
* Keeping a permanent history log of every auto-renewal.

---

## Initial Building Stage & Architecture

Ledger was built with simplicity, speed, and privacy in mind. There is no build step, no framework (like React or Vue), and no backend database. 

* **Vanilla Stack:** Constructed entirely using plain HTML, CSS, and JavaScript. 
* **Styling Engine:** Uses modern CSS variables for a cohesive dark theme (incorporating rust, gold, and teal accents) and BEM-inspired class naming for component isolation.
* **SVG Visualizations:** The burn gauge is built using raw inline SVG paths, manipulated via JavaScript to act as a reactive data visualization.
* **Local Persistence:** Data is strictly stored in the browser's `localStorage` (`ledger.subscriptions.v1`, `ledger.ceiling.v1`, and `ledger.renewalHistory.v1`). Your financial data never leaves your device and effortlessly survives page refreshes.

---

## Core Functionalities

### The Burn Gauge & Metrics
A live fuel-gauge visualization tracks your total monthly spend against a user-configurable "Ceiling." The gauge dynamically changes color from teal (safe) to gold (nearing limit) to rust (over budget).

### Renewals Alert Card
A dedicated module constantly scans your manifest for urgency, aggregating a count and a comma-separated list of any services renewing within 7 days.

### Subscription Manifest
The heart of the app is a dynamic table that sorts your subscriptions by upcoming renewal dates. Rows feature status badges, left-edge color highlights for imminent renewals, and a breakdown of their exact monthly equivalent cost.

### Active / Paused Simulation
Toggling a subscription's "Active" switch instantly greys out its row and removes its cost from the burn rate metric. This acts as a live "what if I canceled this?" simulator, and a separate metric card calculates your total monthly savings from paused items.

### Automated Renewal Rollover
If you don't open the app for a while, your dates don't get stuck in the past. On page load, the app automatically advances any active, past-due subscription to its next valid future billing date. 

### Audit Trail (History Log)
Because auto-changing dates can be confusing, Ledger maintains a persistent "Renewal History" panel. Every time a past-due subscription is rolled forward, it logs the service name, strikes through the old date, displays the new date, and timestamps the automated action.

---

## Under the Hood: Calculations & Logic

The app relies on three core calculation engines in `app.js` to keep the dashboard accurate.

### 1. Cost Uniformity Engine
To calculate the true monthly burn, all inputs must speak the same language. 
* Monthly subscriptions pass their raw cost directly to the total.
* Yearly subscriptions take the inputted cost and divide it by 12. 
* Paused subscriptions are excluded from the array before the final `reduce()` summation runs.

### 2. Date Intersect & Urgency Calculator
The app parses user `YYYY-MM-DD` inputs as local midnight dates and calculates the absolute difference in milliseconds against "today." 
* This millisecond value is divided by `86,400,000` (ms in a day) to yield whole days remaining. 
* If a subscription is active and the remaining days are between `0` and `7`, it triggers the "Renewing Soon" UI states.

### 3. SVG Gauge Math
The dashboard gauge is a 283-pixel SVG arc (roughly π × radius of 90). 
* The app calculates your spend percentage: `monthlyBurn / ceiling`.
* It clamps this value between 0 and 1.
* It multiplies this percentage by 283 to determine the `stroke-dashoffset`, physically revealing the colored arc. 
* The needle's rotation is calculated by mapping the 0–1 percentage to a -90° to +90° rotation transform.

### 4. Rollover Engine Math
When catching up a lapsed date, the app uses a `while` loop to repeatedly add 1 month (or 12 months) until the target date surpasses today. It uses native `Date` object manipulation to clamp days to the end of the month (e.g., rolling Jan 31st forward results in Feb 28th/29th, preventing accidental date skipping).

---

## Running It Locally

Just open `index.html` in a web browser. For a slightly better local development loop (to ensure relative paths and fonts behave exactly like production), serve it with a static file server:

```bash
npx serve .
# or
python3 -m http.server 8080