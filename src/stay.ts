import { addDays, today } from './config.ts';
import { validateBookableDates } from './domain/pricing.ts';

/** Dates and party size from a page address, defaulting to a three-night stay starting tomorrow. */
export function stayParams(url: URLSearchParams) {
  const from = url.get('from') || addDays(today(), 1), to = url.get('to') || addDays(from, 3), guests = Number(url.get('guests') || 2);
  validateBookableDates(from, to);
  return { from, to, guests };
}

/** The first open stay of the given length within the next 60 days, so a home page never opens on taken dates. */
export function firstOpenStay(isOpen: (from: string, to: string) => boolean, nights = 3, start = addDays(today(), 1)) {
  for (let i = 0; i < 60; i++) {
    const from = addDays(start, i), to = addDays(from, nights);
    if (isOpen(from, to)) return { from, to };
  }
  return undefined;
}
