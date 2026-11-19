# Architecture and ownership

RentAPlace is a single local process. Node's HTTP server dispatches into a small router. JSON endpoints, form posts and images are handled by the router; every other page request goes to Next.js (App Router, React Server Components) running inside the same process with the same database connection. Both call the same domain functions. Pages are enhanced by two small browser modules, and all visual assets are served from `public/`.

## Module boundaries

| Area | Primary paths | Review responsibility |
| --- | --- | --- |
| Discovery | `src/domain/search.ts`, search page functions, `test/search.test.ts`, `test/bench.ts` | Filtering, sort order, availability, pagination, timings |
| Pricing and reservations | `src/domain/pricing.ts`, `bookings.ts`, `cancellation.ts`, `payouts.ts`, pricing and booking tests | Integer money, checkout transaction, refunds, host share |
| Host tools | `src/domain/listings.ts`, `calendar.ts`, `host.ts`, `app/host/`, `web/components/portfolio-calendar.tsx`, `test/host.test.ts` | Ownership, editor validation, calendar, reservation response |
| Support and feedback | `src/domain/support.ts`, `feedback.ts`, operations page, `test/operations.test.ts` | Inbox persistence, page context, feature gates |
| Platform | `src/server.ts`, `router.ts`, `db.ts`, `auth.ts`, `log.ts`, `flags.ts`, `db/migrations/` | HTTP boundaries, schema, signed sessions, observability |
| Shared presentation | `app/layout.tsx`, `app/globals.css`, `web/components/`, `public/img/` | shadcn/ui components on Tailwind, accessible controls, responsive layout, generated photography |

CODEOWNERS identifies the repository owner for these paths. A change that crosses areas should describe the cross-module assumptions in its review.

## Persistence

`DatabaseSync` opens `data/rentaplace.db`, enables foreign keys, and applies ordered SQL migrations. The migration ledger stores filenames. Domain operations use prepared statements. Reservation creation, payout scheduling, and the confirmation outbox row commit together under `BEGIN IMMEDIATE`.

Confirmed and pending reservations hold dates. Checkout is exclusive, so a guest can arrive on the previous guest's checkout date. The database owns availability at checkout. A repeated idempotency key returns the existing reservation if the guest, home, dates, and guest count agree.

On cancellation, a full refund cancels the scheduled payout. A partial refund leaves the host share of retained accommodation and the holiday surcharge scheduled, after the platform fee. The refund rules a reservation is made under (free cancellation period, holiday refund window) are saved on it, so later listing edits never change them (decision 0003).

The outbox writer copies pending messages to `outbox/<id>.json` using a temporary file and atomic rename. Delivery failures leave the row pending for retry at startup or the next booking. There is no mail transport.

## Money and time

Money uses integer cents. Each night is priced independently. A night that starts on one of the listing's holiday dates also carries the host's holiday surcharge, a percentage of that night's price rounded per night. Accommodation plus holiday surcharge plus cleaning forms the subtotal; the guest pays a 12% service fee and 8% occupancy tax, each rounded once. The host receives the subtotal less a 3% platform fee. These rates are fixed demo business rules, not jurisdictional tax advice.

`RAP_TODAY` defaults to `2026-11-09`. Business dates and domain timestamps derive from that application date. Request durations use a monotonic timer. `RAP_TODAY=now` selects the current UTC date. The seed always uses its fixed historical dates and PRNG.

## Local boundaries

The server binds to loopback and validates the Host header. Mutating requests with an Origin must come from the same local origin. Sessions are HMAC-signed, HttpOnly, and SameSite=Lax. The signing key is local and ignored by git. The sign-in picker is intentionally passwordless and is not suitable for a public deployment.

Host operations verify ownership on the server. Guest booking reads and cancellations are scoped to the current guest. Operations endpoints only accept loopback connections. Request logs contain paths and IDs, never request bodies, card numbers, or cookies.
