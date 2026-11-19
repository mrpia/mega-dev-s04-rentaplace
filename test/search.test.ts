import test from 'node:test';
import assert from 'node:assert/strict';
import { nearbyListings, parseSearch } from '../src/domain/search.ts';
import type { Listing } from '../src/types.ts';
const q=parseSearch(new URLSearchParams('from=2026-11-10&to=2026-11-13'));
const home=(id:string,extra:Partial<Listing>={}):Listing=>({id,slug:id,title:id,description:'A quiet home',host_id:'host-1',neighbourhood:'Pine Hollow',region:'Smoky Mountains',lat:35,lng:-83,sleeps:4,bedrooms:2,beds:2,bathrooms:1,nightly_cents:10000,weekend_cents:12000,cleaning_cents:5000,cancellation_policy:'flexible',status:'active',instant_book:1,amenities:['Wifi','Kitchen'],photos:[],rating:4.5,review_count:5,created_at:'',updated_at:'',holiday_dates:[],holiday_surcharge_pct:null,holiday_refund_days:null,...extra});
test('free homes appear and occupied homes are omitted',()=>{
 const results=nearbyListings([home('a'),home('b')],[{id:'stay-1',listing_id:'a',from_date:'2026-11-11',to_date:'2026-11-13',status:'confirmed'}],q);
 assert.deepEqual(results.map(h=>h.id),['b']);
});
test('checkout date is exclusive and cancelled reservations release availability',()=>{
 const stays=[{id:'stay-1',listing_id:'a',from_date:'2026-11-08',to_date:'2026-11-10',status:'confirmed'},{id:'stay-2',listing_id:'a',from_date:'2026-11-10',to_date:'2026-11-12',status:'cancelled'}];
 assert.equal(nearbyListings([home('a')],stays,q).length,1);
});
test('filters combine place, price, bedrooms, amenities and instant booking',()=>{
 const f={...q,place:'pine',minPrice:90,maxPrice:120,bedrooms:2,amenities:['Kitchen'],instant:true};
 assert.deepEqual(nearbyListings([home('a'),home('b',{nightly_cents:20000}),home('c',{bedrooms:1}),home('d',{status:'closed'}),home('e',{instant_book:0}),home('f',{amenities:[]})],[],f).map(h=>h.id),['a']);
});
test('price sort puts lower nightly rates first',()=>assert.deepEqual(nearbyListings([home('a',{nightly_cents:15000}),home('b',{nightly_cents:9000})],[],{...q,sort:'price'}).map(h=>h.id),['b','a']));
test('rating sort puts the highest rated home first',()=>assert.deepEqual(nearbyListings([home('a',{rating:4.2}),home('b',{rating:4.9}),home('c',{rating:4.6})],[],{...q,sort:'rating'}).map(h=>h.id),['b','c','a']));
test('search validates filters and date inputs',()=>{
 assert.throws(()=>parseSearch(new URLSearchParams('guests=abc')));assert.throws(()=>parseSearch(new URLSearchParams('sort=unknown')));assert.throws(()=>parseSearch(new URLSearchParams('minPrice=200&maxPrice=10')));
});
