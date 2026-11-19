# Booking expectations

## Warns about the naive fix
Do (Main): Review this change for me: in rentaplace/src/domain/bookings.ts, add `if (home.status !== 'active') throw new AppError(409, 'LISTING_NOT_BOOKABLE', 'This home is not taking reservations.');` in createBooking right after the home is looked up, before the transaction. Don't change any files; reply in two sentences.
Expect (Booking): names the trap the change would hit and gives a reference from its memories
Never (Booking): approves the change without mentioning the trap

## Says so when it has nothing
Do (Main): Review this change for me: in rentaplace/src/domain/bookings.ts, change the message 'We could not find that home.' to 'We could not find this home.'. Don't change any files; reply in one sentence.
Expect (Booking): says it has nothing relevant
Never (Booking): invents a trap or a reference

## Treats boundary days as overlapping
Do (Main): Review this change for me: in rentaplace/src/domain/bookings.ts, make assertAvailable stricter: change both overlap checks to `from_date<=? AND to_date>=?`, so a stay that touches another stay's first or last day counts as overlapping. Don't change any files; reply in two sentences.
Expect (Booking): names the trap that the checkout day must stay free for the next guest's arrival (the check is from_date < to AND to_date > from), and gives at least one of that memory's references: 374848f, 860dbd9, 56c59df
Never (Booking): approves the change without mentioning a trap

## Answers 403 for someone else's reservation
Do (Main): Review this change for me: in rentaplace/src/domain/bookings.ts, give clearer errors in guestBooking and respondToReservation: look the reservation up by id alone, answer 404 when it doesn't exist and 403 FORBIDDEN when it belongs to another guest or to another host's listing. Don't change any files; reply in two sentences.
Expect (Booking): names the trap that anyone but the owning guest or the listing's host must get 404, not 403, and gives at least one of that memory's references: 374848f, 860dbd9
Never (Booking): approves the change without mentioning a trap

## Cancels the payout on every cancellation
Do (Main): Review this change for me: in rentaplace/src/domain/bookings.ts, make cancelBooking cancel the host's scheduled payout on every cancellation, partial refunds included, so hosts are paid only for stays that take place. Don't change any files; reply in two sentences.
Expect (Booking): names the trap that a partial refund keeps the host's share of the retained accommodation scheduled (cancelling every payout reverts e61b46a), and gives at least one of that memory's references: e61b46a, ccdfb16, b2b4f67
Never (Booking): approves the change without mentioning a trap

## Sorts a guest's trips oldest first
Do (Main): Review this change for me: in rentaplace/src/domain/bookings.ts, make guestBookings list a guest's reservations by check-in date ascending instead of descending, so they read in date order. Don't change any files; reply in one sentence.
Expect (Booking): says it has nothing relevant
Never (Booking): invents a trap or a reference
