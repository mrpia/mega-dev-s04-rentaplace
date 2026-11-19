# Local API and CLI

The machine-readable contract lives at `GET /api/openapi.json`. All JSON responses use UTF-8. Error responses have an `error` object with `code`, `message`, and `requestId`.

Start the server at its configured loopback address. The default is `http://127.0.0.1:5180`. For an alternate port, set `PORT` on the server and `RAP_URL` for the CLI or journey.

## Demo sessions

```sh
curl -c /tmp/rap-cookie -H 'Content-Type: application/json' \
  -d '{"userId":"guest-1"}' http://127.0.0.1:5180/api/auth/signin
curl -b /tmp/rap-cookie http://127.0.0.1:5180/api/bookings
```

The API sets a signed `rap_session` cookie. Use a guest for trips and bookings, or a host for the host workspace. `/api/auth/accounts` lists the suggested picker accounts. Other seeded account IDs also work.

## Price and availability

```sh
npm run rap -- quote lakeside-a-frame 2026-11-09 2026-11-12 2 --json
npm run rap -- search Tahoe --from 2026-11-10 --to 2026-11-13 --sort price --json
npm run rap -- book pine-hollow-cabin 2026-11-16 2026-11-19 2 --demo-payment --json
```

Quotes validate dates, guest count and current availability. Each result includes a per-night array (with each night's holiday flag and surcharge), the holiday surcharge and refund window, subtotal, service fee, tax, total, and host share in cents. Search price filters are whole dollars; all stored amounts and returned price values are cents.

POST `/api/bookings` accepts `slug`, `from`, `to`, `guests`, `cardNumber`, optional `guestName`, `guestEmail`, and `idempotencyKey`. Use the test number only. A fresh booking returns 201; a matching idempotent retry returns 200. An overlapping reservation returns 409. Requests for homes without instant confirmation remain pending until the owning host responds.

POST `/api/bookings/{id}/cancel` computes the refund from the saved price snapshot and the terms saved on the reservation (free cancellation period, holiday refund window, policy; decision 0003) and adjusts scheduled payouts to the retained host share, which includes the holiday surcharge after a partial refund; full refunds cancel the payout. GET `/api/bookings` and `/api/bookings/{id}` are guest-scoped.

## Host operations

- GET `/api/host/dashboard`, `/api/host/listings`, `/api/host/reservations`, `/api/host/payouts`.
- POST `/api/host/listings` creates a home; PATCH `/api/host/listings/{slug}` accepts the complete editor payload. `holidayDates`, `holidaySurchargePercent` and `holidayRefundDays` are set together or left empty together; a payload with none of the three keeps the saved holiday settings.
- GET `/api/host/calendar?month=2026-11&slug=lakeside-a-frame` returns daily state.
- POST `/api/host/calendar/blocks` accepts a slug, from, to, and note; DELETE `/api/host/calendar/blocks/{id}` unblocks.
- POST `/api/host/reservations/{id}/respond` accepts `{"action":"accept"}` or `{"action":"decline"}`.
- GET `/api/host/payouts.csv` exports the same payout records as the JSON API.

## Operations

```sh
npm run rap -- stats --json
npm run rap -- logs --slow --json
npm run rap -- logs --errors --limit 20 --json
npm run rap -- flags --json
npm run rap -- flags set map_panel off --json
npm run rap -- flags set map_panel on --json
npm run rap -- support list --json
npm run rap -- doctor --json
```

Operations endpoints are local only. Public support and feedback submission do not require sign-in; support needs a name and email if no account is signed in. Feature flags control immediate booking, the support form, feedback, and the search map. Unknown flags and malformed inputs fail with a clear error. Every CLI command supports `--json` and non-zero failure exits. `seed` and `reset` rebuild the database directly and should be used while the server is stopped.
