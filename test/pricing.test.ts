import test from 'node:test';
import assert from 'node:assert/strict';
import { priceStay, validateDates } from '../src/domain/pricing.ts';
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
test('a holiday night costs the host percentage on top of that night\'s own price, inside the subtotal',()=>{
  // 23 Dec 2026 is a Wednesday: nights Wed 23 (weeknight), Thu 24 (holiday weeknight), Fri 25 (holiday weekend night).
  const holidayHome={...home,holiday_dates:[{first:'2026-12-24',last:'2026-12-25'}],holiday_surcharge_pct:25,holiday_refund_days:30};
  const q=priceStay(holidayHome,'2026-12-23','2026-12-26');
  assert.equal(q.accommodationCents,36000);assert.equal(q.holidayNights,2);assert.equal(q.surchargeCents,2750+3500);
  assert.deepEqual(q.nightly.map(n=>[n.holiday,n.surchargeCents]),[[false,0],[true,2750],[true,3500]]);
  assert.equal(q.subtotalCents,48250);assert.equal(q.serviceFeeCents,5790);assert.equal(q.taxCents,3860);assert.equal(q.totalCents,57900);
  assert.equal(q.hostPayoutCents,46802);assert.equal(q.surchargePercent,25);assert.equal(q.holidayRefundDays,30);
});
test('the surcharge is rounded per night, and a holiday on the checkout date costs nothing',()=>{
  const q=priceStay({...home,nightly_cents:11003,weekend_cents:11003,holiday_dates:[{first:'2026-11-10',last:'2026-11-11'}],holiday_surcharge_pct:15,holiday_refund_days:5},'2026-11-10','2026-11-12');
  assert.equal(q.surchargeCents,3300);
  const checkout=priceStay({...home,holiday_dates:[{first:'2026-11-12',last:'2026-11-12'}],holiday_surcharge_pct:50,holiday_refund_days:5},'2026-11-09','2026-11-12');
  assert.equal(checkout.surchargeCents,0);assert.equal(checkout.holidayNights,0);assert.equal(checkout.holidayRefundDays,null);assert.equal(checkout.subtotalCents,39000);
});
test('invalid dates, reversed ranges and too many guests are rejected',()=>{
  for(const [from,to] of [['2026-02-30','2026-03-03'],['2026-11-12','2026-11-09'],['bad','2026-11-10'],['2026-11-09','2027-03-31']]) assert.throws(()=>validateDates(from,to));
  assert.throws(()=>priceStay(home,'2026-11-09','2026-11-12',5));
});
