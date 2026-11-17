import test from 'node:test';
import assert from 'node:assert/strict';
import { priceStay, validateBookableDates, validateDates } from '../src/domain/pricing.ts';
import { anchors } from '../data/anchors.ts';
const anchor=anchors.find(a=>a.slug==='lakeside-a-frame')!;
const home={slug:anchor.slug,sleeps:anchor.sleeps,nightly_cents:anchor.nightly,weekend_cents:anchor.weekend,cleaning_cents:anchor.cleaning};
test('Lakeside A-Frame: three weeknights and cleaning cost $390 before fees and taxes',()=>{
  const quote=priceStay(home,'2026-11-09','2026-11-12',2);
  assert.equal(quote.subtotalCents,39000);
});
test('fees, taxes and host share use integer cents',()=>{
  const q=priceStay({...home,nightly_cents:11001,weekend_cents:11001},'2026-11-10','2026-11-13');
  assert.equal(q.accommodationCents,33003);assert.equal(q.serviceFeeCents,4680);assert.equal(q.taxCents,3120);
  assert.equal(q.totalCents,46803);assert.equal(q.hostPayoutCents,37833);
  Object.entries(q).filter(([key])=>key.endsWith('Cents')).forEach(([,v])=>assert.equal(Number.isInteger(v),true));
});
test('new stays require three nights without invalidating historical short-stay pricing',()=>{
  assert.throws(()=>validateBookableDates('2026-11-09','2026-11-11'),/between 3 and 90 nights/);
  assert.equal(priceStay(home,'2026-11-09','2026-11-10').nights,1);
});
test('invalid dates, reversed ranges and too many guests are rejected',()=>{
  for(const [from,to] of [['2026-02-30','2026-03-03'],['2026-11-12','2026-11-09'],['bad','2026-11-10'],['2026-11-09','2027-03-31']]) assert.throws(()=>validateDates(from,to));
  assert.throws(()=>priceStay(home,'2026-11-09','2026-11-12',5));
});
