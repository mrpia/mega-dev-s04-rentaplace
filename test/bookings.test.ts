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
test('new reservations require at least three nights',()=>{
 const {db}=fixture(),short={...input,to:'2026-11-12'};
 assert.throws(()=>quote(db,short.slug,short.from,short.to,short.guests),/between 3 and 90 nights/);
 assert.throws(()=>createBooking(db,short,guest),/between 3 and 90 nights/);
 assert.equal((db.prepare('SELECT COUNT(*) n FROM bookings').get() as any).n,0);db.close();
});
test('overlapping checkouts fail and adjacent stays are allowed',()=>{
 const {db}=fixture();createBooking(db,input,guest);assert.throws(()=>createBooking(db,input,otherGuest),{code:'DATES_UNAVAILABLE'});
 const adjacent=createBooking(db,{...input,from:'2026-11-13',to:'2026-11-16'},otherGuest);assert.equal(adjacent.booking.status,'confirmed');db.close();
});
test('idempotent checkout creates one booking and refuses a mismatched retry',()=>{
 const {db}=fixture(),payload={...input,idempotencyKey:'a-stable-request'};
 const a=createBooking(db,payload,guest),b=createBooking(db,payload,guest);assert.equal(a.booking.id,b.booking.id);assert.equal(b.replayed,true);
 assert.equal((db.prepare('SELECT COUNT(*) n FROM payouts').get() as any).n,1);assert.throws(()=>createBooking(db,{...payload,guests:3},guest),{code:'REQUEST_CONFLICT'});db.close();
});
test('reservations are visible only to their guest',()=>{
 const {db}=fixture();const {booking}=createBooking(db,input,guest);assert.equal(guestBookings(db,guest).length,1);assert.equal(guestBookings(db,otherGuest).length,0);assert.throws(()=>guestBooking(db,booking.id,otherGuest),{status:404});assert.throws(()=>cancelBooking(db,booking.id,otherGuest),{status:404});db.close();
});
test('existing short reservations remain readable, cancellable, and replayable',()=>{
 const {db}=fixture(),payload={...input,idempotencyKey:'existing-short-stay'};
 const {booking}=createBooking(db,payload,guest);
 db.prepare('UPDATE bookings SET to_date=?,nights=1 WHERE id=?').run('2026-11-11',booking.id);
 const shortPayload={...payload,to:'2026-11-11'};
 assert.equal(guestBooking(db,booking.id,guest).nights,1);
 assert.equal(createBooking(db,shortPayload,guest).replayed,true);
 assert.equal(cancelBooking(db,booking.id,guest).status,'cancelled');db.close();
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
