import type { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { listingBySlug, transaction } from '../db.ts';
import { AppError, textInput, emailInput, requireValue, integer } from '../errors.ts';
import { priceStay, validateDates } from './pricing.ts';
import { schedulePayout } from './payouts.ts';
import { refundBreakdown } from './cancellation.ts';
import { log } from '../log.ts';
import { enabled } from '../flags.ts';
import { addDays, now, today, OUTBOX_DIR } from '../config.ts';
import { requireUser } from '../auth.ts';
import type { Account } from '../types.ts';
export function assertAvailable(db: DatabaseSync,listingId: string,from: string,to: string) {
  const stay=db.prepare("SELECT id FROM bookings WHERE listing_id=? AND status IN ('confirmed','pending','completed') AND from_date<? AND to_date>? LIMIT 1").get(listingId,to,from);
  const block=db.prepare('SELECT id FROM blocks WHERE listing_id=? AND from_date<? AND to_date>? LIMIT 1').get(listingId,to,from);
  if(stay || block)throw new AppError(409,'DATES_UNAVAILABLE','Those dates are no longer available. Please choose another stay.');
}
export function quote(db: DatabaseSync,slug: string,from: string,to: string,guests=2) {
  const home=listingBySlug(db,slug);
  if(!home)throw new AppError(404,'NOT_FOUND','We could not find that home.');
  validateDates(from,to,true);
  assertAvailable(db,home.id,from,to);
  return priceStay(home,from,to,guests);
}
export function flushOutbox(db: DatabaseSync,outDir=OUTBOX_DIR) {
  const pending=db.prepare("SELECT * FROM email_outbox WHERE status='pending'").all() as any[];
  if(pending.length===0)return;
  mkdirSync(outDir,{recursive:true});
  for(const item of pending) {
    const payload=JSON.parse(item.payload);
    const path=join(outDir,`${item.id}.json`), tmp=path+'.tmp';
    try {writeFileSync(tmp,JSON.stringify(payload,null,2)+'\n',{mode:0o600});renameSync(tmp,path);db.prepare("UPDATE email_outbox SET status='written' WHERE id=?").run(item.id);}
    catch {log('outbox.failed',{bookingId:item.booking_id,message:'Could not write confirmation; will retry.'});}
  }
}
function queueConfirmation(db: DatabaseSync,booking:any,title:string) {
  const id=randomUUID();
  db.prepare('INSERT INTO email_outbox (id,booking_id,payload,status,created_at) VALUES (?,?,?,?,?)').run(id,booking.id,JSON.stringify({to:booking.guest_email,subject:`Your ${title} reservation · ${booking.reference}`,reference:booking.reference,home:title,checkIn:booking.from_date,checkOut:booking.to_date,status:booking.status,totalCents:booking.total_cents,currency:'USD',payment:'Demo payment. No money was charged.',createdAt:now()}),'pending',now());
}
export function createBooking(db: DatabaseSync,input: any,account: Account | undefined) {
  const user=requireUser(account,'guest');
  const slug=textInput(input.slug,'Home',180), from=textInput(input.from,'Check-in',10),to=textInput(input.to,'Check-out',10);
  validateDates(from,to,true);
  const home=listingBySlug(db,slug);
  if(!home)throw new AppError(404,'NOT_FOUND','We could not find that home.');
  const guests=integer(input.guests ?? 2,'Guests',1,home.sleeps);
  const name=textInput(input.guestName || user.name,'Guest name',100),email=emailInput(input.guestEmail || user.email);
  requireValue(typeof input.cardNumber==='string' && input.cardNumber.replace(/[ -]/g,'')==='4242424242424242','Demo payment only: use 4242 4242 4242 4242.');
  const key=input.idempotencyKey?textInput(input.idempotencyKey,'Request key',100):null;
  let payout:any;
  const result=transaction(db,()=>{
    if(key) {
      const prior:any=db.prepare('SELECT * FROM bookings WHERE idempotency_key=?').get(key);
      if(prior) {
        if(prior.guest_id!==user.id || prior.listing_id!==home.id || prior.from_date!==from || prior.to_date!==to || prior.guests!==guests)throw new AppError(409,'REQUEST_CONFLICT','That request key belongs to a different reservation.');
        return {booking:prior,replayed:true};
      }
    }
    assertAvailable(db,home.id,from,to);
    const q=priceStay(home,from,to,guests),id=randomUUID(),reference=`RAP-${id.slice(0,8).toUpperCase()}`;
    const status=home.instant_book && enabled(db,'instant_booking')?'confirmed':'pending';
    // The surcharge, the holiday window and the free cancellation period are saved here, so later host edits never reach this reservation (decision 0003).
    const freeCancelUntil=addDays(today(),1);
    db.prepare(`INSERT INTO bookings (id,reference,listing_id,guest_id,from_date,to_date,guests,guest_name,guest_email,status,nights,accommodation_cents,cleaning_cents,subtotal_cents,service_fee_cents,tax_cents,total_cents,host_payout_cents,policy,payment_status,created_at,idempotency_key,surcharge_cents,holiday_refund_days,free_cancel_until) VALUES (${Array(25).fill('?').join(',')})`).run(id,reference,home.id,user.id,from,to,guests,name,email,status,q.nights,q.accommodationCents,q.cleaningCents,q.subtotalCents,q.serviceFeeCents,q.taxCents,q.totalCents,q.hostPayoutCents,home.cancellation_policy,status==='confirmed'?'paid':'authorized',now(),key,q.surchargeCents,q.holidayRefundDays,freeCancelUntil);
    const booking:any=db.prepare('SELECT * FROM bookings WHERE id=?').get(id);
    if(status==='confirmed')payout=schedulePayout(db,booking,home.host_id);
    queueConfirmation(db,booking,home.title);
    return {booking,replayed:false};
  });
  if(!result.replayed){log('booking.created',{bookingId:result.booking.id,listingId:home.id,status:result.booking.status,totalCents:result.booking.total_cents});if(payout)log('payout.scheduled',payout);}
  flushOutbox(db);
  return result;
}
export function guestBookings(db: DatabaseSync,user: Account | undefined) {
  const account=requireUser(user,'guest');
  return db.prepare('SELECT b.*,l.title,l.slug,l.region,l.photos,l.cancellation_policy FROM bookings b JOIN listings l ON b.listing_id=l.id WHERE b.guest_id=? ORDER BY b.from_date DESC').all(account.id).map((r:any)=>({...r,photos:JSON.parse(r.photos)}));
}
export function guestBooking(db: DatabaseSync,id: string,user: Account | undefined) {
  const account=requireUser(user,'guest');
  const b:any=db.prepare('SELECT b.*,l.title,l.slug,l.region,l.photos FROM bookings b JOIN listings l ON b.listing_id=l.id WHERE b.id=? AND b.guest_id=?').get(id,account.id);
  if(!b)throw new AppError(404,'NOT_FOUND','Reservation not found.');
  return {...b,photos:JSON.parse(b.photos)};
}
export function cancelBooking(db: DatabaseSync,id: string,user: Account | undefined) {
  const booking=guestBooking(db,id,user);
  if(booking.status==='cancelled')return booking;
  requireValue(['confirmed','pending'].includes(booking.status) && booking.from_date>=today(),'This reservation can no longer be cancelled online. Contact support for help.');
  const breakdown=refundBreakdown(booking,today()),refund=breakdown.refundCents;
  // The host keeps the accommodation and holiday surcharge the guest doesn't get back, less the 3% platform fee; a full refund leaves nothing.
  const retained=breakdown.full?0:booking.accommodation_cents-breakdown.refundedAccommodationCents+(booking.surcharge_cents ?? 0);
  const hostPayout=retained-Math.round(retained*3/100);
  const paymentStatus=breakdown.full?'refunded':refund>0?'partially_refunded':'paid';
  const cancelled=transaction(db,()=>{
    const result=db.prepare("UPDATE bookings SET status='cancelled',refund_cents=?,cancelled_at=?,payment_status=?,host_payout_cents=? WHERE id=? AND status IN ('confirmed','pending')").run(refund,now(),paymentStatus,hostPayout,id);
    if(!result.changes)throw new AppError(409,'STATUS_CHANGED','This reservation changed. Refresh before continuing.');
    db.prepare("UPDATE payouts SET status=?,amount_cents=? WHERE booking_id=? AND status='scheduled'").run(hostPayout>0?'scheduled':'cancelled',hostPayout,id);
    return {...booking,status:'cancelled',refund_cents:refund,cancelled_at:now(),payment_status:paymentStatus,host_payout_cents:hostPayout};
  });
  log('booking.cancelled',{bookingId:id,refundCents:refund});
  return cancelled;
}
export function respondToReservation(db: DatabaseSync,id: string,action: string,user: Account | undefined) {
  const account=requireUser(user,'host');
  requireValue(['accept','decline'].includes(action),'Choose accept or decline.');
  let payout:any;
  const booking=transaction(db,()=>{
    const row:any=db.prepare('SELECT b.*,l.title,l.host_id FROM bookings b JOIN listings l ON b.listing_id=l.id WHERE b.id=? AND l.host_id=?').get(id,account.id);
    if(!row)throw new AppError(404,'NOT_FOUND','Reservation not found.');
    if(row.status!=='pending')throw new AppError(409,'STATUS_CHANGED','Only pending requests can be accepted or declined.');
    const status=action==='accept'?'confirmed':'declined';
    db.prepare('UPDATE bookings SET status=?,payment_status=?,refund_cents=? WHERE id=?').run(status,action==='accept'?'paid':'released',action==='decline'?row.total_cents:0,id);
    const updated={...row,status,payment_status:action==='accept'?'paid':'released',refund_cents:action==='decline'?row.total_cents:0};
    if(action==='accept')payout=schedulePayout(db,updated,account.id);
    queueConfirmation(db,updated,row.title);return updated;
  });
  log(`booking.${action==='accept'?'accepted':'declined'}`,{bookingId:id});if(payout)log('payout.scheduled',payout);
  flushOutbox(db);return booking;
}
