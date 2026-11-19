# RentAPlace

A vacation rental marketplace for finding a place, planning a stay, and welcoming guests. Guests can search, inspect prices, reserve with a demo payment, manage trips, and ask for help. Hosts can edit homes, manage calendars, review requests, and export payouts.

All homes, accounts, reservations, and reviews are fictional. The geographic regions are real; the neighbourhoods and homes are invented. Home photos, portraits and scenery are AI-generated and stored in this repository. No real payments, external email, telemetry, or remote assets are used.

## Get started

Requires **Node 24 or 25** and pnpm.

```sh
pnpm install
npm run seed
npm run dev
```

Open **http://127.0.0.1:5180** and choose **Demo sign-in**. If the database is missing, the server creates and seeds it automatically.

Useful demo accounts:

| Account | ID | Workspace |
| --- | --- | --- |
| Mira Valewood | `guest-1` | Guest with an upcoming and a past stay |
| Ellis Ashmere | `guest-2` | Guest with a fresh trip list |
| Rowan Cedarlow | `host-1` | Cedar Ridge Lodge and a larger collection of homes |
| Nori Fernway | `host-5` | Lakeside A-Frame and nearby stays |
| Arden Mossvale | `host-6` | Old Mill Loft and request-based reservations |

The application date is **2026-11-09**. Choose November 10–13 for an available Lakeside A-Frame stay. Use the demo card **4242 4242 4242 4242** at checkout; the card number is never persisted.

## Use it with the MEGA lab

RentAPlace is the sample project in MEGA.dev S04E01. [`lab-scenarios.md`](lab-scenarios.md) holds the two first checks from that lesson, and [`GLOSSARY.md`](GLOSSARY.md) the words it quotes. To follow along with John's own tools for [Pi](https://github.com/earendil-works/pi) and [Herdr](https://github.com/herdrdev/herdr-app), install the three extensions. Nothing in the app needs them.

```sh
pi install git:github.com/johnlindquist/herdr-pi-split            # /split
pi install git:github.com/johnlindquist/herdr-pi-lab              # /lab
pi install --local git:github.com/johnlindquist/herdr-pi-role     # /agent, in this project
```

Run the third line in this folder, then `/reload` in Pi. `/lab doctor` should answer `Lab workspace ready · lab harness ready`. Then ask Main: `Use the lab to run the first check in lab-scenarios.md`. `/lab new critic` and `/lab test critic` need the third line. The lab works on a copy of this project in `~/.lab/rentaplace`; its reports land in `lab-reports/` and `agents/`. `.pi/` and `lab-reports/` are ignored by Git here.

## Commands

```sh
npm start                  # HTTP server without file watching
npm test                   # Domain and contract tests
npm run journey            # HTTP journey; start the server first
npm run bench              # JSON search timings on the current database
npm run rap -- --help
npm run rap -- stats --json
npm run rap -- doctor --json
npm run rap -- quote lakeside-a-frame 2026-11-09 2026-11-12 2 --json
npm run rap -- search Tahoe --from 2026-11-10 --to 2026-11-13 --json
```

`npm run seed` rebuilds the database and removes existing reservations and listing changes. Stop the server before resetting it. The seed is fixed: 700 homes, 120 hosts, 3,000 guests, 10,002 reservations and 4,200 reviews across 14 neighbourhoods. A seed rebuild does not clear previously written confirmation files or request logs.

## Around the app

- `/search` — filters, sorting, pagination, and a map of approximate locations.
- `/homes/lakeside-a-frame` — gallery, reviews, calendar, rules, and full price breakdown.
- `/trips` — reservations and cancellation refunds.
- `/host` — host dashboard, listings, calendar, reservations, and payouts.
- `/help` — support questions, stored locally.
- `/admin` — local health, flags, logs, support, and feedback.
- `/api/openapi.json` — complete JSON API contract.

See [architecture](docs/architecture.md), [API usage](docs/api.md), and the [runbook](docs/runbook.md). Work in progress is tracked in `tracker/board.json`.

<!-- Throwaway line for the Domain Agent guardrails check; this pull request is closed without merging. -->
