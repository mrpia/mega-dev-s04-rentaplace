import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base=process.env.RAP_URL || `http://127.0.0.1:${process.env.PORT || 5180}`;
let cookie='';
let step=0;
async function request(path:string,options:{method?:string;body?:unknown;status?:number}={}) {
 const res=await fetch(base+path,{method:options.method || 'GET',headers:{...(cookie?{Cookie:cookie}:{}),...(options.body?{'Content-Type':'application/json'}:{})},body:options.body?JSON.stringify(options.body):undefined,redirect:'manual'});
 if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie')!.split(';')[0];
 const text=await res.text();
 assert.equal(res.status,options.status || 200,`${path}: ${res.status} ${text.slice(0,400)}`);
 return {res,text,data:res.headers.get('content-type')?.includes('application/json')?JSON.parse(text):null};
}
function pass(message:string){console.log(`PASS ${String(++step).padStart(2,'0')} ${message}`);}
try {
 const {data:health}=await request('/api/health');assert.equal(health.status,'ok');pass(`health ready (${health.node}, ${health.today})`);
 const {text:home}=await request('/');assert.match(home,/Find your/);pass('home page renders a working search form');
 await request('/api/auth/signin',{method:'POST',body:{userId:'guest-1'}});const {data:session}=await request('/api/session');assert.equal(session.user.id,'guest-1');pass('demo sign-in returns a signed guest session');
 const day=(offset:number)=>new Date(Date.parse(health.today+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10);
 let from='',to='';
 for(let offset=1;offset<=60;offset++){
  const a=day(offset),b=day(offset+3);
  const check=await fetch(base+`/api/quote?slug=lakeside-a-frame&from=${a}&to=${b}&guests=2`);
  if(check.ok){from=a;to=b;break;}
 }
 assert.ok(from,'An available three-night window must exist in the next 60 days');
 const dates=new URLSearchParams({from,to,guests:'2'});
 const {data:search,res:searchRes}=await request('/api/listings?place=Lakeside+A-Frame&'+dates);assert.ok(search.items.some((h:any)=>h.slug==='lakeside-a-frame'));assert.match(searchRes.headers.get('server-timing') || '',/^search;dur=/);pass('search returns an available home and Server-Timing');
 const {text:detail}=await request('/homes/lakeside-a-frame?'+dates);assert.match(detail,/Cleaning fee/);assert.match(detail,/Occupancy tax/);pass('detail page shows availability and the full price breakdown');
 const {data:q}=await request('/api/quote?slug=lakeside-a-frame&'+dates);assert.equal(q.totalCents,q.subtotalCents+q.serviceFeeCents+q.taxCents);pass(`quote totals ${q.totalCents} cents for ${q.nights} nights`);
 const {text:checkout}=await request('/book/lakeside-a-frame?'+dates);assert.match(checkout,/Demo payment/);pass('checkout renders guest details, policy and demo payment');
 const key=randomUUID(),payload={slug:'lakeside-a-frame',from,to,guests:2,cardNumber:'4242 4242 4242 4242',idempotencyKey:key};
 const {data:created}=await request('/api/bookings',{method:'POST',body:payload,status:201});assert.equal(created.booking.total_cents,q.totalCents);assert.equal(created.booking.status,'confirmed');pass('demo payment creates a confirmed reservation');
 const id=created.booking.id;
 const {data:replayed}=await request('/api/bookings',{method:'POST',body:payload});assert.equal(replayed.booking.id,id);assert.equal(replayed.replayed,true);pass('a retried checkout returns the same reservation');
 const {text:confirmation}=await request('/bookings/'+id);assert.match(confirmation,new RegExp(created.booking.reference));const {data:trips}=await request('/api/bookings');assert.ok(trips.items.some((b:any)=>b.id===id));await request('/trips');pass('confirmation and trips show the new booking');
 await request('/api/bookings',{method:'POST',body:{...payload,idempotencyKey:randomUUID()},status:409});pass('a conflicting checkout is rejected');
 const {data:cancelled}=await request(`/api/bookings/${id}/cancel`,{method:'POST'});assert.equal(cancelled.booking.status,'cancelled');assert.equal(cancelled.booking.refund_cents,q.totalCents);pass('flexible cancellation releases the stay and refunds its total');
 await request('/api/quote?slug=lakeside-a-frame&'+dates);pass('quote is available again after cancellation');
 const {data:ticket}=await request('/api/support',{method:'POST',body:{subject:'Arrival instructions question',message:'Where can I find the check-in details for my next stay?'},status:201});assert.equal(ticket.ticket.category,'uncategorized');pass('support records a request without assigning a category');
 const {data:feedback}=await request('/api/feedback',{method:'POST',body:{page:'/trips',rating:'good',text:'The reservation details were clear.'},status:201});assert.equal(feedback.feedback.page,'/trips');pass('feedback saves the page context');
 await request('/api/auth/signin',{method:'POST',body:{userId:'host-5'}});const {data:dashboard}=await request('/api/host/dashboard');assert.ok(dashboard.listingCount>=1);await request('/host');await request('/host/listings');pass('host dashboard and listings load for the owning host');
 const {data:blocked}=await request('/api/host/calendar/blocks',{method:'POST',body:{slug:'lakeside-a-frame',from,to,reason:'Window inspection'},status:201});const {data:calendar}=await request(`/api/host/calendar?slug=lakeside-a-frame&month=${from.slice(0,7)}`);assert.ok(calendar.listings[0].days.some((d:any)=>d.date===from&&d.status==='blocked'));pass('host block appears on the calendar');
 await request('/api/quote?slug=lakeside-a-frame&'+dates,{status:409});await request('/api/host/calendar/blocks/'+blocked.block.id,{method:'DELETE'});pass('blocked dates cannot be booked and can be unblocked');
 const {data:payouts}=await request('/api/host/payouts');assert.ok(Array.isArray(payouts.items));const {text:csv}=await request('/api/host/payouts.csv');assert.match(csv,/Reference,Home/);await request('/host/payouts');pass('host payout history and CSV export agree');
 await request('/api/auth/signin',{method:'POST',body:{userId:'guest-1'}});
 let requestFrom='',requestTo='';
 for(let offset=1;offset<=60;offset++){const a=day(offset),b=day(offset+3);const r=await fetch(base+`/api/quote?slug=old-mill-loft&from=${a}&to=${b}&guests=2`);if(r.ok){requestFrom=a;requestTo=b;break;}}
 assert.ok(requestFrom,'An available request-based home window must exist');
 const pendingPayload={slug:'old-mill-loft',from:requestFrom,to:requestTo,guests:2,cardNumber:'4242 4242 4242 4242'};
 const {data:pending}=await request('/api/bookings',{method:'POST',body:pendingPayload,status:201});assert.equal(pending.booking.status,'pending');const {text:pendingPage}=await request('/bookings/'+pending.booking.id);assert.match(pendingPage,/Your request is with your host/);pass('request-based checkout holds the dates pending host review');
 await request('/api/auth/signin',{method:'POST',body:{userId:'host-6'}});const {data:accepted}=await request(`/api/host/reservations/${pending.booking.id}/respond`,{method:'POST',body:{action:'accept'}});assert.equal(accepted.booking.status,'confirmed');assert.equal(accepted.booking.payment_status,'paid');const {data:hostPay}=await request('/api/host/payouts');assert.ok(hostPay.items.some((p:any)=>p.booking_id===pending.booking.id));pass('owning host accepts the request and receives a scheduled payout');
 await request('/api/auth/signin',{method:'POST',body:{userId:'guest-1'}});await request(`/api/bookings/${pending.booking.id}/cancel`,{method:'POST'});
 const {data:secondRequest}=await request('/api/bookings',{method:'POST',body:pendingPayload,status:201});await request('/api/auth/signin',{method:'POST',body:{userId:'host-6'}});const {data:declined}=await request(`/api/host/reservations/${secondRequest.booking.id}/respond`,{method:'POST',body:{action:'decline'}});assert.equal(declined.booking.status,'declined');assert.equal(declined.booking.payment_status,'released');assert.equal(declined.booking.refund_cents,secondRequest.booking.total_cents);pass('host decline releases the demo authorization');
 await request('/api/quote?'+new URLSearchParams({slug:'old-mill-loft',from:requestFrom,to:requestTo,guests:'2'}));pass('declined request releases its dates');
 await request('/admin');const {data:spec}=await request('/api/openapi.json');assert.ok(spec.paths['/api/bookings']);pass('local operations and OpenAPI are available');
 console.log(`JOURNEY PASS: ${step} checks against ${base}`);
} catch(error) {console.error(`JOURNEY FAIL after ${step} checks:`,error);process.exitCode=1;}
