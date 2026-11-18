import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createBooking, quote, cancelBooking, guestBooking, guestBookings, respondToReservation } from '../src/domain/bookings.ts';
import { fixture, guest, otherGuest, host, otherHost, input } from './helpers.ts';
import { OUTBOX_DIR } from '../src/config.ts';
import { hostPayouts } from '../src/domain/payouts.ts';
test('checkout saves a priced reservation, payout and local confirmation without card data',()=>{
 const {db}=fixture();const q=quote(db,input.slug,input.from,input.to,2);const {booking}=createBooking(db,input,guest);
 assert.equal(booking.status,'confirmed');assert.equal(booking.total_cents,q.totalCents);assert.equal(booking.host_payout_cents,q.hostPayoutCents);
 assert.equal(hostPayouts(db,host.id).items[0].scheduled_date,'2026-11-11');
 const outbox:any=db.prepare('SELECT * FROM email_outbox').get();assert.equal(outbox.status,'written');assert.equal(JSON.parse(outbox.payload).reference,booking.reference);
 const file=readFileSync(join(OUTBOX_DIR,outbox.id+'.json'),'utf8');assert.ok(!file.includes('4242424242424242')&&!file.includes('4242 4242 4242 4242'));assert.ok(!JSON.stringify(booking).includes('4242424242424242'));db.close();
});
test('invalid demo payment, past dates and excess guests leave no reservation',()=>{
 const {db}=fixture();for(const bad of [{cardNumber:'5555 5555 5555 4444'},{from:'2026-10-01',to:'2026-10-03'},{guests:9}])assert.throws(()=>createBooking(db,{...input,...bad},guest));
 assert.equal((db.prepare('SELECT COUNT(*) n FROM bookings').get() as any).n,0);db.close();
});
test('overlapping checkouts fail and adjacent stays are allowed',()=>{
 const {db}=fixture();createBooking(db,input,guest);assert.throws(()=>createBooking(db,input,otherGuest),{code:'DATES_UNAVAILABLE'});
 const adjacent=createBooking(db,{...input,from:'2026-11-13',to:'2026-11-14'},otherGuest);assert.equal(adjacent.booking.status,'confirmed');db.close();
});
test('idempotent checkout creates one booking and refuses a mismatched retry',()=>{
 const {db}=fixture(),payload={...input,idempotencyKey:'a-stable-request'};
 const a=createBooking(db,payload,guest),b=createBooking(db,payload,guest);assert.equal(a.booking.id,b.booking.id);assert.equal(b.replayed,true);
 assert.equal((db.prepare('SELECT COUNT(*) n FROM payouts').get() as any).n,1);assert.throws(()=>createBooking(db,{...payload,guests:3},guest),{code:'REQUEST_CONFLICT'});db.close();
});
test('paused and closed homes refuse quotes and checkouts and leave no reservation',()=>{
 for(const status of ['paused','closed']) {
  const {db}=fixture();db.prepare('UPDATE listings SET status=? WHERE slug=?').run(status,input.slug);
  assert.throws(()=>quote(db,input.slug,input.from,input.to,2),{status:409,code:'LISTING_NOT_BOOKABLE'});
  assert.throws(()=>createBooking(db,input,guest),{status:409,code:'LISTING_NOT_BOOKABLE'});
  for(const table of ['bookings','payouts','email_outbox'])assert.equal((db.prepare(`SELECT COUNT(*) n FROM ${table}`).get() as any).n,0,`${status}: ${table}`);
  db.close();
 }
});
test('closing a home keeps its reservations: retries replay, guests cancel, hosts answer requests',()=>{
 const {db}=fixture(),payload={...input,idempotencyKey:'made-before-closing'};
 const confirmed=createBooking(db,payload,guest).booking,pending=createBooking(db,{...input,slug:'courtyard-loft'},otherGuest).booking;
 db.prepare("UPDATE listings SET status='closed' WHERE slug=?").run(input.slug);db.prepare("UPDATE listings SET status='paused' WHERE slug='courtyard-loft'").run();
 const retry=createBooking(db,payload,guest);assert.equal(retry.replayed,true);assert.equal(retry.booking.id,confirmed.id);
 assert.throws(()=>createBooking(db,{...payload,idempotencyKey:'made-after-closing',from:'2026-11-20',to:'2026-11-22'},guest),{code:'LISTING_NOT_BOOKABLE'});
 assert.equal(respondToReservation(db,pending.id,'accept',host).status,'confirmed');
 const cancelled=cancelBooking(db,confirmed.id,guest);assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.refund_cents,confirmed.total_cents);db.close();
});
test('reservations are visible only to their guest',()=>{
 const {db}=fixture();const {booking}=createBooking(db,input,guest);assert.equal(guestBookings(db,guest).length,1);assert.equal(guestBookings(db,otherGuest).length,0);assert.throws(()=>guestBooking(db,booking.id,otherGuest),{status:404});assert.throws(()=>cancelBooking(db,booking.id,otherGuest),{status:404});db.close();
});
test('flexible cancellation refunds the payment, cancels payout and is idempotent',()=>{
 const {db}=fixture();const {booking}=createBooking(db,input,guest),cancelled=cancelBooking(db,booking.id,guest);
 assert.equal(cancelled.refund_cents,booking.total_cents);assert.equal(cancelled.status,'cancelled');assert.equal(hostPayouts(db,host.id).items[0].status,'cancelled');assert.equal(cancelBooking(db,booking.id,guest).refund_cents,booking.total_cents);assert.ok(quote(db,input.slug,input.from,input.to,2));db.close();
});
test('non-instant reservations await the owning host and schedule a payout only on acceptance',()=>{
 const {db}=fixture();const {booking}=createBooking(db,{...input,slug:'courtyard-loft'},guest);assert.equal(booking.status,'pending');assert.equal(hostPayouts(db,host.id).items.length,0);
 assert.throws(()=>respondToReservation(db,booking.id,'accept',otherHost),{status:404});const accepted=respondToReservation(db,booking.id,'accept',host);assert.equal(accepted.status,'confirmed');assert.equal(hostPayouts(db,host.id).items.length,1);assert.throws(()=>respondToReservation(db,booking.id,'decline',host),{status:409});db.close();
});
test('declining a request releases payment authorization and availability',()=>{
 const {db}=fixture();const {booking}=createBooking(db,{...input,slug:'courtyard-loft'},guest);respondToReservation(db,booking.id,'decline',host);const updated:any=db.prepare('SELECT * FROM bookings WHERE id=?').get(booking.id);assert.equal(updated.payment_status,'released');assert.equal(updated.refund_cents,booking.total_cents);assert.ok(quote(db,'courtyard-loft',input.from,input.to,2));db.close();
});
test('a failed confirmation insert rolls back the booking and payout together',()=>{
 const {db}=fixture();db.exec("CREATE TRIGGER reject_outbox BEFORE INSERT ON email_outbox BEGIN SELECT RAISE(ABORT,'outbox unavailable'); END");
 assert.throws(()=>createBooking(db,input,guest),/outbox unavailable/);assert.equal((db.prepare('SELECT COUNT(*) n FROM bookings').get() as any).n,0);assert.equal((db.prepare('SELECT COUNT(*) n FROM payouts').get() as any).n,0);db.close();
});

test('strict cancellation preserves the host share of retained accommodation',()=>{
 const {db}=fixture();db.prepare("UPDATE listings SET cancellation_policy='strict' WHERE slug=?").run(input.slug);
 const {booking}=createBooking(db,{...input,from:'2026-11-23',to:'2026-11-30'},guest);
 const cancelled=cancelBooking(db,booking.id,guest);assert.equal(cancelled.refund_cents,51060);assert.equal(cancelled.payment_status,'partially_refunded');assert.equal(cancelled.host_payout_cents,40255);
 const payout=hostPayouts(db,host.id).items[0];assert.equal(payout.status,'scheduled');assert.equal(payout.amount_cents,40255);db.close();
});
