# Booking scenarios

## Host changes the holiday refund window after a reservation
<!-- Rule: checkout saves holiday_refund_days on the reservation (src/domain/bookings.ts:74) and cancellation reads only the saved value (cancellation.ts:33); b2b4f67, PR #2; glossary.md "Refund terms", memories.md "createBooking saves surcharge_cents, holiday_refund_days …". -->
Ask: A guest reserved a holiday stay when the host's holiday refund window was 14 days. The host then raises it to 30 days. The guest cancels 20 days before check-in. Which refund window applies to that reservation?
Expect: the 14-day window saved on the reservation applies
Expect: gives b2b4f67 or PR #2 as the reference
Never: applies the host's new 30-day window to that reservation
