import test from 'node:test';
import assert from 'node:assert/strict';
import { cancellationRefund, refundBreakdown, policyText } from '../src/domain/cancellation.ts';
const b={from_date:'2026-11-23',accommodation_cents:33000,cleaning_cents:6000,tax_cents:3120,total_cents:46800};
test('the moderate text promises what the code refunds exactly five days before check-in',()=>{
  assert.equal(cancellationRefund({...b,policy:'moderate'},'2026-11-18'),24060);assert.equal(cancellationRefund({...b,policy:'moderate'},'2026-11-17'),46800);
  assert.doesNotMatch(policyText.moderate,/at least 5 days/);assert.match(policyText.moderate,/more than 5 days/);
});
test('the free cancellation period refunds everything through the business day after reserving, whatever the policy',()=>{
  const r={...b,policy:'strict' as const,free_cancel_until:'2026-11-10'};
  assert.equal(cancellationRefund(r,'2026-11-09'),46800);assert.equal(cancellationRefund(r,'2026-11-10'),46800);assert.equal(cancellationRefund(r,'2026-11-11'),6000);
});
test('reservations saved before these rules keep the old refunds',()=>{
  assert.equal(cancellationRefund({...b,policy:'strict'},'2026-11-09'),24060);assert.equal(cancellationRefund({...b,policy:'moderate'},'2026-11-20'),24060);
});
test('a holiday stay gets a full refund N or more days out, or the policy refund, whichever is more',()=>{
  const s={...b,policy:'strict' as const,holiday_refund_days:10};
  assert.equal(cancellationRefund(s,'2026-11-13'),46800);assert.equal(cancellationRefund(s,'2026-11-14'),6000);
  const m={...b,policy:'moderate' as const,holiday_refund_days:3};
  assert.equal(cancellationRefund(m,'2026-11-17'),46800);assert.equal(cancellationRefund(m,'2026-11-20'),46800);assert.equal(cancellationRefund(m,'2026-11-21'),24060);
});
test('a partial refund never returns the holiday surcharge or the tax on it; a full refund returns everything',()=>{
  const s={from_date:'2026-11-23',policy:'strict' as const,accommodation_cents:33000,surcharge_cents:3300,cleaning_cents:6000,tax_cents:3384,total_cents:50760};
  assert.deepEqual(refundBreakdown(s,'2026-11-09'),{refundCents:24060,refundedAccommodationCents:16500,full:false});
  assert.deepEqual(refundBreakdown({...s,policy:'flexible'},'2026-11-09'),{refundCents:50760,refundedAccommodationCents:33000,full:true});
  assert.deepEqual(refundBreakdown({...s,policy:'flexible'},'2026-11-23'),{refundCents:6000,refundedAccommodationCents:0,full:false});
});
test('flexible policy refunds the full stay at least one day before arrival',()=>{assert.equal(cancellationRefund({...b,policy:'flexible'},'2026-11-22'),46800);assert.equal(cancellationRefund({...b,policy:'flexible'},'2026-11-23'),6000);assert.equal(cancellationRefund({...b,policy:'flexible'},'2026-11-24'),0);});
test('strict policy applies a partial refund at 14 days and cleaning-only closer to arrival',()=>{assert.equal(cancellationRefund({...b,policy:'strict'},'2026-11-09'),24060);assert.equal(cancellationRefund({...b,policy:'strict'},'2026-11-10'),6000);assert.equal(cancellationRefund({...b,policy:'strict'},'2026-11-24'),0);});
