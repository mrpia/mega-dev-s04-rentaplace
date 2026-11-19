# RentAPlace glossary

One meaning per word. People and agents use these words the same way in prompts, code, pages and tests. When a word here and the code disagree, fix one of them in the same change.

## People

- **Guest**: a person who searches for a home, reserves a stay and pays for it.
- **Host**: a person who owns one or more listings, keeps their calendars and receives payouts.
- **Operator**: a member of the team who uses the operations page (`/admin`). Not a guest and not a host.

## Homes

- **Listing**: a host's offer of one whole home: its title, region, photos, how many it sleeps, its prices and its cancellation policy. Code and tables say `listing`; pages say "home". They are the same thing.
- **Region**: one of the 14 areas a guest searches by, such as Lake Tahoe.
- **Sleeps**: the largest number of guests a listing accepts.
- **Listing status**: whether a listing takes new reservations. The host sets it in the listing editor.
  - **Active**: shown in search and open to new reservations.
  - **Paused**: hidden from search; quotes and new reservations are refused. The host means it to be temporary.
  - **Closed**: hidden from search; quotes and new reservations are refused. The host has stopped renting the home.
  - Paused and closed stop only new reservations. Reservations already made stay as they are: the guest can cancel under the saved policy, and the host can still accept or decline a pending request.
- **Instant book**: a listing setting. When it is on, a new reservation is confirmed at once. When it is off, the host must accept it first.

## Stays and dates

- **Stay**: the nights a guest spends at a listing, from check-in to checkout.
- **Check-in**: the first date of a stay (`from_date`).
- **Checkout**: the date the guest leaves (`to_date`). It is exclusive: a guest who checks out on the 12th does not occupy the night of the 12th, so another stay may check in that day.
- **Night**: one date of a stay. A stay from the 10th to the 12th is two nights.
- **Weekend night**: a Friday or Saturday night, charged at the listing's weekend price.
- **Holiday date**: a date the host marks as a holiday on one listing. Hosts set their own dates; the listing stores them as ranges whose first and last dates both count.
- **Holiday night**: the night that starts on a holiday date. A holiday on the checkout date is not a holiday night of that stay, since checkout is never charged.
- **Holiday stay**: a stay with at least one holiday night.
- **Today**: the business date, `RAP_TODAY`. Never the clock on the wall.

## Reservations

- **Reservation**: a guest's claim on a listing for a stay. Code and tables say `booking`; pages and emails say "reservation". They are the same thing.
- **Reference**: the short code a guest quotes when asking about a reservation.
- **Status**: where a reservation stands.
  - **Pending**: requested, waiting for the host. The dates are held.
  - **Confirmed**: accepted, or made by instant book. The dates are held and a payout is scheduled.
  - **Declined**: the host said no. The guest is refunded in full and the dates are free.
  - **Cancelled**: the guest withdrew. The dates are free and the refund follows the cancellation policy.
  - **Completed**: the stay has happened.
- **Reservation conflict**: two claims on the same night of the same listing. Pending, confirmed and completed reservations hold their nights; declined and cancelled ones do not.
- **Block**: dates a host closes on their own calendar, with a note such as "Personal use". A block cannot cover a night that a reservation holds.
- **Available**: a night with no block and no reservation holding it.

## Money

All money is whole US cents.

- **Quote**: the full price of a stay, shown before the guest reserves. The first price a guest sees is the price they pay.
- **Accommodation**: the sum of the nightly prices for every night of the stay, without the holiday surcharge.
- **Holiday surcharge**: the host's percentage (1 to 50) of a holiday night's own price, weekend price included, rounded to the cent for each night. It belongs to the host, less the platform fee, like accommodation.
- **Cleaning fee**: a fixed amount per stay, set by the host.
- **Subtotal**: accommodation plus the holiday surcharge plus the cleaning fee.
- **Service fee**: 12% of the subtotal, charged to the guest. It is refunded only with a full refund.
- **Tax**: 8% of the subtotal.
- **Total**: subtotal plus service fee plus tax.
- **Payout**: what the host receives for a reservation, scheduled for the day after check-in.

## Cancelling

- **Cancellation policy**: the listing's refund rule, fixed on the reservation when it is made.
  - **Flexible**: a full refund up to one day before check-in.
  - **Moderate**: a full refund more than five days before check-in; after that, half of accommodation and tax, plus the cleaning fee.
  - **Strict**: at least 14 days before check-in, half of accommodation and tax, plus the cleaning fee; closer than that, the cleaning fee only.
- **Free cancellation period**: from the day a reservation is made through the next business date. A cancellation in that period is refunded in full, whatever the policy. Saved on the reservation; reservations made before it existed have none.
- **Holiday refund window**: the host's number of days (1 to 60). A holiday stay cancelled at least that many days before check-in is refunded in full; closer than that it gets nothing from the window. The guest gets whichever of the window and the policy refunds more, so the window can only add to a refund. Saved on the reservation when it is made.
- **Refund**: what the guest gets back. A pending reservation is always refunded in full. A partial refund never includes the holiday surcharge or the tax on it.

## Words to avoid

- **Booking** in anything a guest or host reads. Say "reservation".
- **Property**, **unit**, **rental**. Say "listing" in code and "home" on pages.
- **Customer**, **user**. Say "guest" or "host"; they have different rights.
- **Check-out day** as a night of the stay. Checkout is exclusive.
- **Hold** for anything but dates. Pending and confirmed reservations hold their dates; that is the only meaning. What was first asked for as a "24-hour hold" is the **free cancellation period**.
- **Minimum stay** has no meaning yet. No rule uses it, so define it here before building it: is it per listing or for the whole site, and does it change reservations that already exist?
