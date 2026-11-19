# 0003 — Holiday surcharge, free cancellation period and holiday refund window

Date: 2026-11-19

## Decision

Three changes, each on its own tracker card, sharing one definition of a holiday.

**Holiday dates.** Each host sets holiday dates per listing, freely. A holiday night is the night that starts on a holiday date; a holiday on the checkout date costs nothing. A stay with at least one holiday night is a holiday stay. Holiday dates, the surcharge percentage and the refund days are set together or not at all, with the percentage between 1 and 50 and the days between 1 and 60.

**Holiday surcharge** (card `holiday-surcharge`). The host's percentage of each holiday night's own price, so a Friday or Saturday holiday takes it from the weekend price. It is rounded per night, as each night is priced on its own (decision 0002). It is part of the subtotal, so the service fee, the tax, the host share and the 3% platform fee all include it. A partial refund never returns the surcharge or the tax on it; the host keeps the surcharge, less the platform fee. A full refund returns everything.

**Free cancellation period** (card `free-cancellation-period`, first asked for as a "24-hour hold"). Every reservation can be cancelled for a full refund, service fee included, whatever the policy, from the day it is made through the next business date. RentAPlace has a business date and no clock (`RAP_TODAY`), so the period is counted in business dates, not hours.

**Holiday refund window** (card `holiday-refund-window`). For a holiday stay, a full refund when cancelled at least the host's number of days before check-in, and nothing from the window after that. The guest gets whichever of the window and the listing's policy refunds more. Pending requests keep their full refund. If a holiday-stay refund is ever zero, the host is paid the accommodation and surcharge less the platform fee, without the cleaning fee.

**Saved on the reservation.** The surcharge, the holiday refund window and the last day of the free cancellation period are saved when the reservation is made. Later host edits never reach it, and reservations made before this decision have none of the three and keep the rules they were made under.

**Service fee.** It is refunded with a full refund, as the code already did; the glossary said "never refunded" and is corrected.

## Why

Decision 0002 saves the price and the cancellation policy on the reservation, but only the policy's name was saved and the rule lived in code, so changing a rule would have changed refunds on existing reservations. Saving the new terms on the reservation keeps 0002's promise for them.

The host share after a cancellation was worked out from the refund amount alone (all, none or half of accommodation). With the surcharge kept back on partial refunds and the new full-refund cases, the refund now states how much accommodation it returns, and the payout is computed from that.

The card asked for a "tight" refund window. The owner chose "whichever refunds more", knowing that with it the window can only add to a refund and never lowers one below the listing's policy.

## Consequences

- Migration `003-holidays.sql` adds the three listing settings and the three reservation fields.
- The receipt shows the surcharge on its own line, so the weeknight and weekend lines still add up to accommodation.
- The examples of decision 0002 are unchanged: Lakeside A-Frame has no holiday dates, and the strict-cancellation test keeps refund 51060 and payout 40255, now cancelled two business days after reserving so the free cancellation period has ended.
- The demo seed gives Harbor Point Cottage (2026-11-16 to 2027-01-06, 25%, 30 days) and Cedar Ridge Lodge (2026-12-19 to 2027-01-03, 20%, 3 days) holiday settings.
- Search results still show each home's weeknight price; the surcharge appears on the home page and in the quote.
