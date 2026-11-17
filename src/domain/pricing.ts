import { addDays, daysBetween, today } from '../config.ts';
export const MIN_STAY_NIGHTS = 3;
import { requireValue, integer } from '../errors.ts';
import type { Listing, Quote } from '../types.ts';
export function validDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
}
export function validateDates(from: string, to: string, future = false): number {
  requireValue(validDate(from) && validDate(to), 'Use valid dates in YYYY-MM-DD format.');
  const nights = daysBetween(from, to);
  requireValue(nights >= 1 && nights <= 90, 'Choose a stay between 1 and 90 nights.');
  if (future) requireValue(from >= today(), 'Check-in cannot be in the past.');
  return nights;
}
export function validateBookableDates(from: string, to: string, future = false): number {
  const nights = validateDates(from, to, future);
  requireValue(nights >= MIN_STAY_NIGHTS, `Choose a stay between ${MIN_STAY_NIGHTS} and 90 nights.`);
  return nights;
}
export function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 5 || day === 6;
}
export function priceStay(home: Pick<Listing, 'slug' | 'sleeps' | 'nightly_cents' | 'weekend_cents' | 'cleaning_cents'>, from: string, to: string, guests = 2): Quote {
  const nights = validateDates(from, to);
  integer(guests, 'Guests', 1, home.sleeps);
  const nightly = Array.from({ length: nights }, (_, i) => {
    const date = addDays(from, i), weekend = isWeekend(date);
    return { date, weekend, cents: weekend ? home.weekend_cents : home.nightly_cents };
  });
  const accommodationCents = nightly.reduce((n, line) => n + line.cents, 0);
  const cleaningCents = home.cleaning_cents;
  const subtotalCents = accommodationCents + cleaningCents;
  const serviceFeeCents = Math.round(subtotalCents * 12 / 100);
  const taxCents = Math.round(subtotalCents * 8 / 100);
  return {
    slug: home.slug, from, to, guests, nights, nightly,
    weeknightNights: nightly.filter(n => !n.weekend).length,
    weekendNights: nightly.filter(n => n.weekend).length,
    weeknightCents: home.nightly_cents, weekendCents: home.weekend_cents,
    accommodationCents, cleaningCents, subtotalCents, serviceFeeCents, taxCents,
    totalCents: subtotalCents + serviceFeeCents + taxCents,
    hostPayoutCents: subtotalCents - Math.round(subtotalCents * 3 / 100), currency: 'USD'
  };
}
