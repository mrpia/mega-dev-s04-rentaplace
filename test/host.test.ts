import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture,guest,host,otherHost,input } from './helpers.ts';
import { hostCalendar,blockDates,unblockDates,monthDates } from '../src/domain/calendar.ts';
import { quote,createBooking } from '../src/domain/bookings.ts';
import { hostListings,saveListing,ownedListing,dollarsToCents } from '../src/domain/listings.ts';
import { dashboard,reservations } from '../src/domain/host.ts';
import { payoutsCsv,hostPayouts } from '../src/domain/payouts.ts';
const newHome={title:'Willow Cottage',description:'A fictional cottage beside a quiet meadow.',neighbourhood:'Fern Way',region:'Oregon Coast',sleeps:4,bedrooms:2,beds:3,bathrooms:1,nightlyCents:13500,weekendCents:16000,cleaningCents:5000,cancellationPolicy:'flexible',status:'active',instantBook:true,amenities:['Wifi','Kitchen'],photos:['/img/photos/coast-0.jpg']};
test('a host can create and edit a listing, with ownership enforced',()=>{
 const {db}=fixture();const saved=saveListing(db,newHome,host);assert.equal(saved.host_id,host.id);assert.equal(saved.nightly_cents,13500);const updated=saveListing(db,{...newHome,title:'Willow House',nightlyCents:14500},host,saved.slug);assert.equal(updated.nightly_cents,14500);assert.equal(updated.slug,saved.slug);assert.throws(()=>saveListing(db,newHome,otherHost,saved.slug),{status:404});assert.throws(()=>ownedListing(db,saved.slug,guest),{status:403});assert.equal(hostListings(db,host).length,3);db.close();
});
test('listing validation rejects invalid money, amenities, capacity and remote images',()=>{
 const {db}=fixture();for(const bad of [{nightlyCents:1.2},{sleeps:99},{amenities:['Helipad']},{photos:['https://example.test/home.svg']},{status:'unknown'},{lat:200}])assert.throws(()=>saveListing(db,{...newHome,...bad},host));assert.equal(dollarsToCents('110.09'),11009);assert.throws(()=>dollarsToCents('1.999'));db.close();
});
test('holiday dates, surcharge and refund days are saved together and within limits',()=>{
 const {db}=fixture();const holiday={holidayDates:'2026-11-16 to 2027-01-06\n2027-04-03',holidaySurchargePercent:'20',holidayRefundDays:'30'};
 const saved=saveListing(db,{...newHome,...holiday},host);
 assert.deepEqual(saved.holiday_dates,[{first:'2026-11-16',last:'2027-01-06'},{first:'2027-04-03',last:'2027-04-03'}]);assert.equal(saved.holiday_surcharge_pct,20);assert.equal(saved.holiday_refund_days,30);
 for(const bad of [{holidaySurchargePercent:'',holidayRefundDays:''},{holidayRefundDays:''},{holidayDates:'',holidaySurchargePercent:'20',holidayRefundDays:'30'},{holidaySurchargePercent:'51'},{holidaySurchargePercent:'0'},{holidayRefundDays:'61'},{holidayRefundDays:'0'},{holidayDates:'2027-01-06 to 2026-11-16'},{holidayDates:'2026-02-30'},{holidaySurchargePercent:'12.5'}])
  assert.throws(()=>saveListing(db,{...newHome,...holiday,...bad},host,saved.slug),JSON.stringify(bad));
 assert.equal(saveListing(db,newHome,host,saved.slug).holiday_surcharge_pct,20,'an edit without the holiday fields keeps them');
 const cleared=saveListing(db,{...newHome,holidayDates:'',holidaySurchargePercent:'',holidayRefundDays:''},host,saved.slug);
 assert.deepEqual(cleared.holiday_dates,[]);assert.equal(cleared.holiday_surcharge_pct,null);assert.equal(cleared.holiday_refund_days,null);db.close();
});
test('calendar blocks constrain quotes and can only be removed by their owner',()=>{
 const {db}=fixture();const block=blockDates(db,host,{...input,reason:'Repairs'});const cal=hostCalendar(db,host,'2026-11','lakeside-a-frame');assert.equal(cal.listings[0].days.find(d=>d.date==='2026-11-10')?.status,'blocked');assert.throws(()=>quote(db,input.slug,input.from,input.to),{status:409});assert.throws(()=>unblockDates(db,otherHost,block.id),{status:404});unblockDates(db,host,block.id);assert.ok(quote(db,input.slug,input.from,input.to));db.close();
});
test('blocking dates never overwrites an existing reservation',()=>{
 const {db}=fixture();createBooking(db,input,guest);assert.throws(()=>blockDates(db,host,input),{code:'RESERVATION_CONFLICT'});assert.equal((db.prepare('SELECT COUNT(*) n FROM blocks').get() as any).n,0);db.close();
});
test('month grids respect leap years and reject invalid months',()=>{assert.equal(monthDates('2028-02').length,29);assert.equal(monthDates('2026-02').length,28);assert.throws(()=>monthDates('2026-13'));});
test('dashboard occupancy, reservations and payouts reflect a confirmed stay',()=>{
 const {db}=fixture();const {booking}=createBooking(db,input,guest);const d=dashboard(db,host);assert.equal(d.bookedNights,3);assert.equal(d.earningsCents,booking.host_payout_cents);assert.equal(reservations(db,host).length,1);const data=hostPayouts(db,host.id);assert.equal(data.scheduledCents,booking.host_payout_cents);const csv=payoutsCsv(data.items);assert.match(csv,/Reference,Home/);assert.match(csv,new RegExp(booking.reference));db.close();
});
