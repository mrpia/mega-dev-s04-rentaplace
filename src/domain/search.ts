import type { DatabaseSync } from 'node:sqlite';
import { decodeListing } from '../db.ts';
import { addDays, today } from '../config.ts';
import { integer, requireValue } from '../errors.ts';
import { validateBookableDates } from './pricing.ts';
import type { Listing, Stay } from '../types.ts';
export class BrokenStayError extends Error {
  stay: Stay;
  constructor(stay: Stay) { super(`Stay ${stay.id} has status broken`); this.name='BrokenStayError'; this.stay=stay; }
}
export type SearchQuery = {place: string; from: string; to: string; guests: number; minPrice: number; maxPrice: number; bedrooms: number; amenities: string[]; instant: boolean; sort: string; page: number; limit: number};
export function parseSearch(params: URLSearchParams): SearchQuery {
  const from = params.get('from') || addDays(today(),1), to = params.get('to') || addDays(from,3);
  validateBookableDates(from,to);
  const sort = params.get('sort') || 'recommended';
  requireValue(['recommended','price','rating'].includes(sort),'Choose recommended, price, or rating sort.');
  const minPrice=integer(params.get('minPrice') || 0,'Minimum price',0,10000), maxPrice=integer(params.get('maxPrice') || 10000,'Maximum price',0,10000);
  requireValue(maxPrice >= minPrice, 'Maximum price must be at least the minimum price.');
  return {place:(params.get('place') || '').trim(),from,to,guests:integer(params.get('guests') || 2,'Guests',1,20),minPrice,maxPrice,bedrooms:integer(params.get('bedrooms') || 0,'Bedrooms',0,15),amenities:params.getAll('amenities').flatMap(v=>v.split(',')).filter(Boolean),instant:params.get('instant')==='1',sort,page:integer(params.get('page') || 1,'Page',1,10000),limit:integer(params.get('limit') || 12,'Limit',1,60)};
}
export function nearbyListings(homes: Listing[], stays: Stay[], q: SearchQuery): Listing[] {
  const out: Listing[] = [], place=q.place.toLowerCase();
  for (const home of homes) {
    if (home.status!=='active' || home.sleeps<q.guests || home.bedrooms<q.bedrooms) continue;
    if (place && !`${home.title} ${home.neighbourhood} ${home.region}`.toLowerCase().includes(place)) continue;
    if(home.nightly_cents<q.minPrice*100 || home.nightly_cents>q.maxPrice*100) continue;
    if(q.instant && !home.instant_book) continue;
    if(!q.amenities.every(a=>home.amenities.includes(a))) continue;
    let free=true;
    for(const stay of stays) {
      if(stay.listing_id!==home.id) continue;
      if(stay.status==='broken') throw new BrokenStayError(stay);
      if(['confirmed','pending','completed','blocked'].includes(stay.status) && stay.from_date<q.to && q.from<stay.to_date) free=false;
    }
    if(free) out.push(home);
  }
  if(q.sort==='rating') out.sort((a,b)=>b.rating-a.rating || a.slug.localeCompare(b.slug));
  else if(q.sort==='price') out.sort((a,b)=>a.nightly_cents-b.nightly_cents || a.slug.localeCompare(b.slug));
  else out.sort((a,b)=>(b.review_count*0.015+b.rating)-(a.review_count*0.015+a.rating) || a.slug.localeCompare(b.slug));
  return out;
}
export function loadSearchData(db: DatabaseSync) {
  const homes=db.prepare('SELECT * FROM listings ORDER BY id').all().map(decodeListing);
  const stays=db.prepare("SELECT id,listing_id,from_date,to_date,status FROM bookings WHERE status <> 'broken'").all().map(row => ({...row})) as Stay[];
  const blocks=db.prepare("SELECT id,listing_id,from_date,to_date,'blocked' as status FROM blocks").all().map(row => ({...row})) as Stay[];
  return {homes,stays:[...stays,...blocks]};
}
export function search(db: DatabaseSync, q: SearchQuery) {
  const start=performance.now(), {homes,stays}=loadSearchData(db), all=nearbyListings(homes,stays,q);
  return {items:all.slice((q.page-1)*q.limit,q.page*q.limit),total:all.length,page:q.page,pages:Math.max(1,Math.ceil(all.length/q.limit)),query:q,searchMs:Math.round((performance.now()-start)*100)/100};
}
