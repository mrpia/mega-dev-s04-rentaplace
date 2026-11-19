import { EXTERIOR_COUNTS, INTERIOR_COUNT } from './images.ts';
import { existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { openDatabase, decodeListing } from '../src/db.ts';
import { DB_PATH, addDays } from '../src/config.ts';
import { priceStay } from '../src/domain/pricing.ts';
import { anchors, regions } from './anchors.ts';

export function seedDatabase(db: DatabaseSync, seed = 260609): Record<string, number> {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  const first = ['Mira','Ellis','Nori','Arden','Liora','Rowan','Ember','Soren','Briar','Cleo','Aster','Rumi','Tavi','Iona','Wren','Milo','Thea','Linden','Esme','Orin'];
  const last = ['Valewood','Ashmere','Briarwick','Fernway','Meadowell','Cedarlow','Mossvale','Elmsworth','Hallowell','Ridgewell','Oakmere','Brookvale','Wyndell','Pinewell','Larkspur'];
  const demoUsers = [
    ['guest-1','Mira Valewood','mira@example.test','guest'],
    ['guest-2','Ellis Ashmere','ellis@example.test','guest'],
    ['host-1','Rowan Cedarlow','rowan@example.test','host'],
    ['host-5','Nori Fernway','nori@example.test','host'],
    ['host-6','Arden Mossvale','arden@example.test','host']
  ];
  const amenities = ['Wifi','Kitchen','Free parking','Heating','Washer','Patio','Fireplace','Air conditioning','EV charger','Lake access','Pet friendly','Workspace'];
  const reviewTexts = [
    'A quiet place with a comfortable bed and a very useful kitchen.',
    'Easy arrival and plenty of room. The trail map was a thoughtful touch.',
    'The setting was lovely. We would have liked brighter reading lights.',
    'Clean, warm, and well equipped for a long weekend.',
    'The road was a little narrow, but the directions were accurate.',
    'Good space for cooking together and a peaceful porch in the morning.',
    'Comfortable stay. Sound carried between the bedrooms more than expected.',
    'Everything we needed was there. The Wi-Fi worked well for a short work call.',
    'A beautiful base for exploring. The sofa could use an upgrade.',
    'Simple check-in, fresh towels, and a kitchen that was actually stocked.'
  ];
  db.exec('BEGIN IMMEDIATE');
  try {
    const userStmt = db.prepare('INSERT INTO users VALUES (?, ?, ?, ?)');
    for (let i = 1; i <= 120; i++) {
      const id = `host-${i}`, named = demoUsers.find(u => u[0] === id);
      userStmt.run(...(named || [id,`${pick(first)} ${pick(last)}`,`host${i}@example.test`,'host']));
    }
    for (let i = 1; i <= 3000; i++) {
      const id = `guest-${i}`, named = demoUsers.find(u => u[0] === id);
      userStmt.run(...(named || [id,`${pick(first)} ${pick(last)}`,`guest${i}@example.test`,'guest']));
    }
    const regionStmt = db.prepare('INSERT INTO regions VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const r of regions) regionStmt.run(r[0],r[1],r[2],r[3],r[4],r[5],`/img/photos/${r[6]}-0.jpg`);
    const listStmt = db.prepare(`INSERT INTO listings (id,slug,host_id,title,description,neighbourhood,region,lat,lng,sleeps,bedrooms,beds,bathrooms,nightly_cents,weekend_cents,cleaning_cents,cancellation_policy,status,instant_book,amenities,photos,rating,review_count,created_at,updated_at) VALUES (${Array(25).fill('?').join(',')})`);
    const adjectives = ['Juniper','Stillwater','Fern','Meadow','Copper','Willow','Alder','Sunlit','Driftwood','Woodland','Hearth','Moss','Birch','Bluebell','Foxglove'];
    const nouns = ['Cottage','Cabin','Retreat','Hideaway','House','Loft','Lodge','Bungalow','Studio','A-Frame'];
    for (let i = 0; i < 700; i++) {
      const a = anchors[i], r = regions[a ? a.region : i % regions.length];
      const type = a?.image || r[6], variant = i % 4;
      const bedrooms = a?.bedrooms ?? 1 + Math.floor(random()*4);
      const sleeps = a?.sleeps ?? Math.min(12,bedrooms*2 + (random()>.65 ? 2 : 0));
      const nightly = a?.nightly ?? (75 + Math.floor(random()*220))*100;
      const weekend = a?.weekend ?? Math.round(nightly*1.23/500)*500;
      const amen = a ? ['Wifi','Kitchen','Free parking','Heating','Patio', ...(type==='lake'?['Lake access']:['Fireplace'])] : amenities.filter((_,j) => j < 4 || random() > .58);
      const title = a?.title || `${adjectives[i%adjectives.length]} ${nouns[Math.floor(i/adjectives.length)%nouns.length]}`;
      const description = `${title} is a ${bedrooms===0?'bright studio':'welcoming '+bedrooms+'-bedroom home'} in ${r[1]}, ${r[2]}. Open the windows, put the kettle on, and settle into a slower pace. ${pick(['A covered porch catches the morning light.','A generous table makes room for shared meals.','Large windows bring the surrounding landscape inside.','The living room has a deep sofa and a shelf of books.'])}\n\nYou will have the entire place to yourself, with a full kitchen, fresh linens, and clear arrival instructions. ${pick(['The last stretch of road is unpaved; drive slowly after rain.','A short walk takes you to the neighbourhood trail.','The bedrooms are upstairs, reached by one flight of stairs.','Parking for two cars is beside the entrance.'])}`;
      listStmt.run(`home-${i+1}`,a?.slug || `${title.toLowerCase().replaceAll(' ','-')}-${r[0]}-${i+1}`,`host-${a?.host ?? (i<60?1:2+(i%119))}`,title,description,r[1],r[2],r[3]+(random()-.5)*.08,r[4]+(random()-.5)*.08,sleeps,bedrooms,Math.max(1,bedrooms+1),Math.max(1,Math.ceil(bedrooms/2)),nightly,weekend,a?.cleaning ?? (35+Math.floor(random()*70))*100,a?.policy || pick(['flexible','moderate','strict']),a?.status || (random()<.045?'paused':'active'),a?.instant ?? (random()<.8?1:0),JSON.stringify(amen),JSON.stringify([a ? `/img/photos/anchor-${a.slug}.jpg` : `/img/photos/${type}-${i % EXTERIOR_COUNTS[type]}.jpg`,`/img/photos/interior-${(i*3) % INTERIOR_COUNT}.jpg`,`/img/photos/${type}-${(i+5) % EXTERIOR_COUNTS[type]}.jpg`,`/img/photos/interior-${(i*3+11) % INTERIOR_COUNT}.jpg`]),0,0,'2026-06-01T09:00:00.000Z','2026-10-28T11:00:00.000Z');
    }
    // Demo holiday pricing (decision 0003): set by each host per listing. Lakeside A-Frame stays without, so decision 0002's example is unchanged.
    const holidayStmt = db.prepare('UPDATE listings SET holiday_dates=?, holiday_surcharge_pct=?, holiday_refund_days=? WHERE slug=?');
    holidayStmt.run(JSON.stringify([{first:'2026-11-16',last:'2027-01-06'}]),25,30,'harbor-point-cottage');
    holidayStmt.run(JSON.stringify([{first:'2026-12-19',last:'2027-01-03'}]),20,3,'cedar-ridge-lodge');
    const homes = db.prepare('SELECT * FROM listings ORDER BY rowid').all().map(decodeListing);
    const users = new Map(db.prepare('SELECT * FROM users').all().map((u:any)=>[u.id,u]));
    const occupied = new Map<string, Set<string>>();
    const bStmt = db.prepare(`INSERT INTO bookings (id,reference,listing_id,guest_id,from_date,to_date,guests,guest_name,guest_email,status,nights,accommodation_cents,cleaning_cents,subtotal_cents,service_fee_cents,tax_cents,total_cents,host_payout_cents,refund_cents,policy,payment_status,created_at,cancelled_at,surcharge_cents,holiday_refund_days,free_cancel_until) VALUES (${Array(26).fill('?').join(',')})`);
    const pStmt = db.prepare('INSERT INTO payouts VALUES (?,?,?,?,?,?,?)');
    let accepted = 0, tries = 0;
    while (accepted < 10000) {
      if (++tries > 100000) throw new Error('Booking seed exhausted');
      const home = pick(homes), nights = pick([2,2,3,3,4,5,7]);
      let start = Math.floor(random()*297);
      if (random()<.22) start = Math.floor(random()*92);
      let from = addDays('2026-06-01',start);
      if (random()<.35) from=addDays(from,(5-new Date(`${from}T00:00:00Z`).getUTCDay()+7)%7);
      const to = addDays(from,nights);
      if(to>'2027-03-31')continue;
      if (Number(home.id.slice(5)) <= 8 && from < '2026-11-23' && to > '2026-11-08') continue;
      const roll = random();
      const status = roll < .02 ? 'broken' : roll < .17 ? 'cancelled' : to <= '2026-11-09' ? 'completed' : (!home.instant_book && random()<.30 ? 'pending':'confirmed');
      const dates = Array.from({length:nights},(_,i)=>addDays(from,i));
      const busy = occupied.get(home.id) || new Set();
      if (['completed','confirmed','pending'].includes(status) && dates.some(d=>busy.has(d))) continue;
      if (['completed','confirmed','pending'].includes(status)) dates.forEach(d=>busy.add(d));
      occupied.set(home.id,busy);
      const i=++accepted, id=`stay-${String(i).padStart(5,'0')}`;
      const guestId = `guest-${3+Math.floor(random()*2998)}`, user:any=users.get(guestId);
      const guests = 1+Math.floor(random()*home.sleeps), q=priceStay(home,from,to,guests);
      const created = `${addDays(from,-(7+Math.floor(random()*100)))}T10:30:00.000Z`;
      bStmt.run(id,`RAP-${String(i).padStart(6,'0')}`,home.id,guestId,from,to,guests,user.name,user.email,status,nights,q.accommodationCents,q.cleaningCents,q.subtotalCents,q.serviceFeeCents,q.taxCents,q.totalCents,q.hostPayoutCents,status==='cancelled'?q.totalCents:0,home.cancellation_policy,status==='cancelled'?'refunded':status==='pending'?'authorized':'paid',created,status==='cancelled'?`${addDays(from,-5)}T10:00:00.000Z`:null,q.surchargeCents,q.holidayRefundDays,addDays(created.slice(0,10),1));
      if (['completed','confirmed'].includes(status)) {
        const date = addDays(from,1), paid=date<'2026-11-09';
        pStmt.run(`payout-${i}`,id,home.host_id,q.hostPayoutCents,date,paid?date:null,paid?'paid':'scheduled');
      }
    }
    const reviewStmt = db.prepare('INSERT INTO reviews VALUES (?, ?, ?, ?, ?, ?)');
    const completed:any[] = db.prepare("SELECT * FROM bookings WHERE status='completed' ORDER BY id LIMIT 4200").all();
    completed.forEach((b,i)=>reviewStmt.run(`review-${i+1}`,b.listing_id,b.guest_id,pick([3,4,4,5,5,5,5,5]),pick(reviewTexts),`${addDays(b.to_date,2)}T12:00:00.000Z`));
    db.exec('UPDATE listings SET rating = COALESCE((SELECT ROUND(AVG(rating),2) FROM reviews WHERE listing_id=listings.id),0), review_count=(SELECT COUNT(*) FROM reviews WHERE listing_id=listings.id)');
    const demoTrips = [
      {home:homes[3],from:'2026-11-25',to:'2026-11-28',status:'confirmed'},
      {home:homes[1],from:'2026-08-03',to:'2026-08-06',status:'completed'}
    ];
    for (let i=0;i<demoTrips.length;i++) {
      const {home,from,to,status}=demoTrips[i], q=priceStay(home,from,to,2), id=`demo-trip-${i+1}`;
      const conflicts:any[] = db.prepare("SELECT id FROM bookings WHERE listing_id=? AND from_date<? AND to_date>? AND status IN ('confirmed','completed','pending')").all(home.id,to,from);
      for(const conflict of conflicts) {
        db.prepare("UPDATE bookings SET status='cancelled', payment_status='refunded', refund_cents=total_cents, cancelled_at='2026-07-01T10:00:00.000Z' WHERE id=?").run(conflict.id);
        db.prepare("UPDATE payouts SET status='cancelled', paid_date=NULL WHERE booking_id=?").run(conflict.id);
      }
      bStmt.run(id,`RAP-DEMO0${i+1}`,home.id,'guest-1',from,to,2,'Mira Valewood','mira@example.test',status,q.nights,q.accommodationCents,q.cleaningCents,q.subtotalCents,q.serviceFeeCents,q.taxCents,q.totalCents,q.hostPayoutCents,0,home.cancellation_policy,'paid','2026-07-01T10:00:00.000Z',null,q.surchargeCents,q.holidayRefundDays,'2026-07-02');
      const date=addDays(from,1);pStmt.run(`payout-demo-${i+1}`,id,home.host_id,q.hostPayoutCents,date,status==='completed'?date:null,status==='completed'?'paid':'scheduled');
    }
    const support = [
      ['Refund timing','I cancelled a flexible stay yesterday. When will the refund show up?'],
      ['Unable to find my confirmation','I booked a cabin but cannot find the confirmation in my inbox.'],
      ['Calendar is slow to respond','The calendar takes a while to react when I move between dates.'],
      ['Pet policy question','Does the pet-friendly amenity include two small dogs?'],
      ['Payout date question','My guest checked in yesterday. When is the payout scheduled?'],
      ['Update my arrival time','We will arrive after 9 pm. How do I let the host know?'],
      ['Closed listing still available','The Beach House looks closed but I can still open its checkout.'],
      ['Holiday booking length','Can I require longer stays for the holiday period starting November 16?']
    ];
    const sStmt = db.prepare('INSERT INTO support_tickets VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for(let i=0;i<28;i++) {
      const pair=support[i%support.length], id=i%3===0?'host-1':'guest-1', user:any=users.get(id);
      sStmt.run(`ticket-${String(i+1).padStart(4,'0')}`,id,user.name,user.email,pair[0],pair[1],'uncategorized',null,'open',`${addDays('2026-10-23',Math.floor(i/2))}T09:00:00.000Z`);
    }
    const flagStmt=db.prepare('INSERT INTO flags VALUES (?,?,?)');
    for(const [name,desc] of [['instant_booking','Allow immediate confirmation on eligible homes'],['guest_feedback','Show the page feedback form'],['support_form','Accept new support requests'],['map_panel','Show the search map']]) flagStmt.run(name,1,desc);
    const fStmt=db.prepare('INSERT INTO feedback VALUES (?,?,?,?,?,?)');
    fStmt.run('feedback-1','guest-1','/search','good','Clear prices, but I would like to save a search.','2026-11-07T15:20:00.000Z');
    fStmt.run('feedback-2','host-1','/host/calendar','needs-work','The calendar is difficult to use with many homes.','2026-11-08T11:10:00.000Z');
    db.exec('COMMIT');
    return {homes:700,hosts:120,guests:3000,bookings:10002,reviews:completed.length,supportTickets:28};
  } catch(e) { db.exec('ROLLBACK'); throw e; }
}
export function rebuildDatabase(path = DB_PATH): Record<string, number> {
  for (const suffix of ['', '-wal', '-shm']) if(existsSync(path+suffix)) rmSync(path+suffix);
  const db = openDatabase(path);
  try { return seedDatabase(db); } finally { db.close(); }
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) console.log(JSON.stringify({event:'database.seeded',...rebuildDatabase()}));
