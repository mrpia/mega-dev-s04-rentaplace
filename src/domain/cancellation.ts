import { daysBetween } from '../config.ts';
import type { Policy } from '../types.ts';
// What a refund needs from a saved reservation. The last three fields are saved only on reservations made under
// decision 0003; reservations made before it have none of them and keep the rules they were made under.
export type RefundTerms = {
  from_date:string;policy:Policy;accommodation_cents:number;cleaning_cents:number;tax_cents:number;total_cents:number;status?:string;
  surcharge_cents?:number|null;holiday_refund_days?:number|null;free_cancel_until?:string|null;
};
// refundedAccommodationCents is the part of accommodation that goes back to the guest; the host is paid from the rest.
export type Refund = {refundCents:number;refundedAccommodationCents:number;full:boolean};
const TAX_PERCENT=8;
function policyRefund(b: RefundTerms,days: number): Refund {
  const full={refundCents:b.total_cents,refundedAccommodationCents:b.accommodation_cents,full:true};
  // A partial refund returns half of accommodation and half of the tax on everything except the holiday surcharge:
  // neither the surcharge nor its tax is refunded on a partial refund (decision 0003).
  const surchargeTax=Math.round((b.surcharge_cents ?? 0)*TAX_PERCENT/100);
  const half={refundCents:Math.round(b.accommodation_cents/2)+b.cleaning_cents+Math.round((b.tax_cents-surchargeTax)/2),refundedAccommodationCents:Math.round(b.accommodation_cents/2),full:false};
  const cleaningOnly={refundCents:b.cleaning_cents,refundedAccommodationCents:0,full:false};
  if(b.policy==='flexible' && days>=1)return full;
  if(b.policy==='moderate' && days>5)return full;
  if(b.policy==='strict' && days>=14)return half;
  if(b.policy==='moderate')return half;
  return cleaningOnly;
}
export function refundBreakdown(b: RefundTerms,cancelDate: string): Refund {
  const days=daysBetween(cancelDate,b.from_date);
  if(days<0)return {refundCents:0,refundedAccommodationCents:0,full:false};
  const full={refundCents:b.total_cents,refundedAccommodationCents:b.accommodation_cents,full:true};
  if(b.status==='pending')return full;
  if(b.free_cancel_until && cancelDate<=b.free_cancel_until)return full;
  // The holiday window gives a full refund N or more days before check-in and nothing after; the guest gets
  // whichever of it and the policy refunds more, so it can only add to the policy refund.
  if(b.holiday_refund_days!=null && days>=b.holiday_refund_days)return full;
  return policyRefund(b,days);
}
export function cancellationRefund(b: RefundTerms,cancelDate: string): number {
  return refundBreakdown(b,cancelDate).refundCents;
}
export const policyText = {
  flexible:'Full refund when cancelled at least 1 day before check-in. After that, the cleaning fee is refunded before arrival.',
  moderate:'Full refund when cancelled more than 5 days before check-in. After that, 50% of accommodation and tax, plus the cleaning fee, is refunded before arrival.',
  strict:'At least 14 days before check-in: 50% of accommodation and tax, plus the cleaning fee. Closer to check-in: cleaning fee only. The service fee is refunded only with a full refund.'
};
export const freeCancellationText='Free cancellation until the day after you reserve: a full refund, service fee included.';
export function holidayWindowText(days: number): string {
  return `Stays with a holiday night: a full refund when cancelled at least ${days} ${days===1?'day':'days'} before check-in, or the policy refund if that is more. A partial refund never includes the holiday surcharge or its tax.`;
}
