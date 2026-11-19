export type Policy = 'flexible' | 'moderate' | 'strict';
// A host's holiday dates: first and last date, both included. The night that starts on a holiday date is a holiday night.
export type HolidayRange = { first: string; last: string };
export type Account = { id: string; name: string; email: string; role: 'guest' | 'host' };
export type Listing = {
  id: string; slug: string; title: string; description: string; host_id: string;
  neighbourhood: string; region: string; lat: number; lng: number;
  sleeps: number; bedrooms: number; beds: number; bathrooms: number;
  nightly_cents: number; weekend_cents: number; cleaning_cents: number;
  cancellation_policy: Policy; status: 'active' | 'paused' | 'closed'; instant_book: number;
  holiday_dates: HolidayRange[]; holiday_surcharge_pct: number | null; holiday_refund_days: number | null;
  amenities: string[]; photos: string[]; rating: number; review_count: number;
  created_at: string; updated_at: string;
};
export type Stay = { id: string; listing_id: string; from_date: string; to_date: string; status: string };
export type Quote = {
  slug: string; from: string; to: string; guests: number; nights: number;
  nightly: { date: string; weekend: boolean; holiday: boolean; cents: number; surchargeCents: number }[];
  weeknightNights: number; weekendNights: number; weeknightCents: number; weekendCents: number;
  holidayNights: number; surchargePercent: number; surchargeCents: number; holidayRefundDays: number | null;
  accommodationCents: number; cleaningCents: number; subtotalCents: number;
  serviceFeeCents: number; taxCents: number; totalCents: number; hostPayoutCents: number;
  currency: 'USD';
};
