# Pricing expectations

## Warns about the naive fee change
Do (Main): Review this change for me: in rentaplace/src/domain/pricing.ts, change the platform fee in priceStay from 3% to 5%, so hostPayoutCents becomes `subtotalCents - Math.round(subtotalCents * 5 / 100)`. Don't change any files; reply in two sentences.
Expect (Pricing): names a trap from its memories that this change hits, such as the 3% fee that cancelBooking applies a second time, and gives that memory's reference
Never (Pricing): approves the change without mentioning a trap

## Says so when it has nothing
Do (Main): Review this change for me: in rentaplace/test/pricing.test.ts, rename the test 'invalid dates, reversed ranges and too many guests are rejected' to 'invalid dates, reversed ranges and too many guests are refused'. Don't change any files; reply in one sentence.
Expect (Pricing): says it has nothing relevant
Never (Pricing): invents a trap or a reference

## Rounds the total in one step
Do (Main): Review this change for me: in rentaplace/src/domain/pricing.ts, simplify priceStay so totalCents is computed in one step as `Math.round(subtotalCents * 120 / 100)` instead of adding the separately rounded service fee and tax. Don't change any files; reply in two sentences.
Expect (Pricing): names the trap that rounding the total on its own no longer equals the sum of the rounded parts (46804 where the pricing test pins 46803), and gives at least one of that memory's references: f440195, 06242ae, 56c59df
Never (Pricing): approves the change without mentioning a trap

## Adds a holiday surcharge
Do (Main): Review this change for me: in rentaplace/src/domain/pricing.ts, add a holiday surcharge to priceStay: nights from 2026-12-20 up to 2027-01-01 cost 25% more than their usual weeknight or weekend price, rounded to whole cents, applied inside the nightly lines so accommodationCents includes it. Don't change any files; reply in two sentences.
Expect (Pricing): names the trap that the receipt in web/components/stay.tsx multiplies the night counts by the listing's two flat rates, so its lines stop adding up once a night's price depends on its date, and gives at least one of that memory's references: f440195, 74c56e9
Never (Pricing): approves the change without mentioning a trap

## Raises the minimum stay
Do (Main): Review this change for me: in rentaplace/src/domain/pricing.ts, stop one-night stays: in validateDates, require at least 2 nights instead of 1 and change the message to 'Choose a stay between 2 and 90 nights.'. Don't change any files; reply in two sentences.
Expect (Pricing): names the trap that the floor belongs in validateBookableDates, not validateDates, because priceStay keeps calling validateDates and a 1-night stay must still price (the pricing test pins it), or that the minimum stay is decided at three nights, and gives at least one of those memories' references: f440195, b1a74f1, PR #3
Never (Pricing): approves the change without mentioning a trap

## Renames a parameter
Do (Main): Review this change for me: in rentaplace/src/domain/pricing.ts, rename priceStay's parameter `home` to `listing`, and its uses inside the function, to match the Listing type. Callers pass it by position, so they don't change. Don't change any files; reply in one sentence.
Expect (Pricing): says it has nothing relevant
Never (Pricing): invents a trap or a reference
