# 0003 — Paused and closed homes take no new reservations

Date: 2026-11-18

## Decision

Only an active listing takes new reservations. Quotes and checkouts for a paused or closed home are refused with 409 `LISTING_NOT_BOOKABLE`. The check sits in the domain layer, so pages, API and CLI agree. The home page stays reachable and says the home is not taking reservations.

Reservations made before the status changed stay as they are. Their payouts stay scheduled, guests can cancel them under the saved policy, hosts can accept or decline pending requests, and an idempotent retry of an earlier checkout returns that reservation.

## Why

Search already hid every listing that is not active, but checkout never read the status. A guest with a direct link could reserve Beach House, which is closed, or any of the 27 paused homes (board card `closed-home-booking`).

Changing a listing's status is a host edit, and 0002 already says a host edit must not change an existing guest's reservation. Hosts also have no way to cancel a confirmed stay, so cancelling stays on close would happen without anyone choosing it. Your trips links to the home page, so the page stays.

## Consequences

In the seed, Beach House keeps its 5 confirmed future stays (the first on 2026-12-17), and the paused homes keep 110 confirmed and 6 pending ones. A host who closes a home with future stays still hosts them; there is no host-side cancellation. For guests, paused and closed behave the same; the difference is only what the host intends.
