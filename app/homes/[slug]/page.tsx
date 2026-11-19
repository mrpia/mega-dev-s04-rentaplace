import Link from 'next/link';
import { ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, KeyRound, Leaf, Sun, Wifi, LayoutGrid } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { DateRangeFields, GuestSelect } from '@/components/forms';
import { Gallery } from '@/components/gallery';
import { Page, UserAvatar } from '@/components/site';
import { Legend, MonthGrid, PriceLines, Rating, SummaryCard } from '@/components/stay';
import { attempt, db, homeBySlug, toURLSearchParams, type SearchParams } from '@/lib/server';
import { capitalize, dateLabel, money, plural } from '@/lib/format';
import { firstOpenStay, stayParams } from '../../../src/stay.ts';
import { quote } from '../../../src/domain/bookings.ts';
import { listingCalendar, monthDates } from '../../../src/domain/calendar.ts';
import { policyText } from '../../../src/domain/cancellation.ts';
import { addDays, today } from '../../../src/config.ts';

type Props = { params: Promise<{ slug: string }>; searchParams: SearchParams };

export async function generateMetadata({ params }: Props) {
  return { title: homeBySlug((await params).slug).title };
}

const AMENITY_ICONS: Record<string, typeof Check> = { Wifi, 'Lake access': Sun, Workspace: LayoutGrid };

export default async function HomeDetail({ params, searchParams }: Props) {
  const { slug } = await params;
  const home = homeBySlug(slug);
  const search = toURLSearchParams(await searchParams);
  const database = db();
  const bookable = home.status === 'active';
  if (bookable && !search.has('from')) {
    const open = firstOpenStay((from, to) => attempt(() => quote(database, home.slug, from, to, 2)).ok);
    if (open) { search.set('from', open.from); search.set('to', open.to); }
  }
  const stay = attempt(() => stayParams(search));
  const p = stay.ok ? stay.value : { from: addDays(today(), 1), to: addDays(today(), 4), guests: 2 };
  const host = database.prepare('SELECT id,name FROM users WHERE id=?').get(home.host_id) as { id: string; name: string };
  const reviews = database.prepare('SELECT rating,text,created_at FROM reviews WHERE listing_id=? ORDER BY created_at DESC LIMIT 6').all(home.id) as { rating: number; text: string; created_at: string }[];
  const q = stay.ok ? attempt(() => quote(database, home.slug, p.from, p.to, p.guests)) : stay;
  const month = search.get('month') || p.from.slice(0, 7);
  const calendar = listingCalendar(database, home, month);
  const days = monthDates(month);
  const prev = addDays(days[0], -1).slice(0, 7), next = addDays(days.at(-1)!, 1).slice(0, 7);
  const monthLink = (m: string) => { const x = new URLSearchParams(search); x.set('month', m); return `/homes/${home.slug}?${x}#availability`; };
  const bookingLink = `/book/${home.slug}?${new URLSearchParams({ from: p.from, to: p.to, guests: String(p.guests) })}`;
  const reviewers = ['guest-11', 'guest-27', 'guest-42', 'guest-58', 'guest-73', 'guest-96'];

  return (
    <Page className="pt-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink asChild><Link href="/search">All homes</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink asChild><Link href={`/search?place=${encodeURIComponent(home.region)}`}>{home.region}</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>{home.neighbourhood}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mt-4 mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl sm:text-5xl">{home.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Rating value={home.rating} className="text-foreground" />
            <a href="#reviews" className="underline-offset-4 hover:underline">({plural(home.review_count, 'review')})</a>
            <span>·</span><span>{home.neighbourhood}, {home.region}</span>
          </div>
        </div>
        <Badge variant="secondary" className="w-fit rounded-full">{!bookable ? 'Not taking reservations' : home.instant_book ? 'Instant booking' : 'Request to book'}</Badge>
      </div>

      <Gallery title={home.title} photos={home.photos} />
      <p className="mt-2 text-xs text-muted-foreground">Images are AI-generated. This home is fictional.</p>

      <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-10">
          <section className="flex items-center justify-between gap-6">
            <div className="space-y-1">
              <h2 className="text-3xl">A whole home, all to yourself.</h2>
              <p className="text-muted-foreground">{plural(home.sleeps, 'guest')} · {home.bedrooms === 0 ? 'Studio' : plural(home.bedrooms, 'bedroom')} · {plural(home.beds, 'bed')} · {home.bathrooms} {home.bathrooms === 1 ? 'bath' : 'baths'}</p>
            </div>
            <UserAvatar user={host} className="size-14 ring-4 ring-secondary" />
          </section>

          <div className="grid gap-5 rounded-2xl border bg-card p-6">
            {[
              [KeyRound, 'Settle in with self check-in', 'Your arrival instructions are in your reservation.'],
              [Leaf, `A quieter corner of ${home.neighbourhood}`, 'Space to slow down, with room for your own routine.'],
              [CalendarDays, `${capitalize(home.cancellation_policy)} cancellation policy`, 'Review the refund details before you book.'],
            ].map(([Icon, title, text]) => {
              const I = Icon as typeof Check;
              return (
                <div key={title as string} className="flex gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-primary"><I className="size-5" /></span>
                  <div><p className="font-medium">{title as string}</p><p className="text-sm text-muted-foreground">{text as string}</p></div>
                </div>
              );
            })}
          </div>

          <section className="space-y-3">
            <h2 className="text-3xl">A little about this place</h2>
            <p className="leading-relaxed text-foreground/85">{home.description}</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl">Make yourself comfortable</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {home.amenities.map((a) => { const I = AMENITY_ICONS[a] ?? Check; return <span key={a} className="flex items-center gap-3 text-sm"><I className="size-4 text-primary" />{a}</span>; })}
            </div>
          </section>

          {bookable ? <section id="availability" className="scroll-mt-24 space-y-4">
            <h2 className="text-3xl">Room in the calendar</h2>
            <div className="max-w-md space-y-4 rounded-2xl border bg-card p-5">
              <div className="flex items-center justify-between">
                <Button asChild variant="outline" size="icon-sm"><Link href={monthLink(prev)} aria-label="Previous month" scroll={false}><ChevronLeft /></Link></Button>
                <span className="font-medium">{dateLabel(`${month}-01`, { month: 'long', year: 'numeric' })}</span>
                <Button asChild variant="outline" size="icon-sm"><Link href={monthLink(next)} aria-label="Next month" scroll={false}><ChevronRight /></Link></Button>
              </div>
              <MonthGrid calendar={calendar} />
              <Legend items={[['available', 'Available'], ['booked', 'Reserved'], ['blocked', 'Blocked'], ['pending', 'Request pending']]} />
            </div>
          </section> : null}

          <section id="reviews" className="scroll-mt-24 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl">Notes from recent stays</h2>
              <Rating value={home.rating} count={home.review_count} />
            </div>
            {reviews.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {reviews.map((r, i) => (
                  <article key={i} className="space-y-3 rounded-2xl border bg-card p-5">
                    <div className="flex items-center gap-3">
                      <UserAvatar user={{ id: reviewers[i % reviewers.length] + home.id, name: 'Verified guest' }} className="size-9" />
                      <div className="text-sm">
                        <p className="font-medium" aria-label={`${r.rating} out of 5 stars`}>{'★'.repeat(r.rating)}<span className="text-muted-foreground">{'☆'.repeat(5 - r.rating)}</span></p>
                        <p className="text-xs text-muted-foreground">Verified stay · {dateLabel(r.created_at.slice(0, 10), { month: 'short', year: 'numeric' })}</p>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed">{r.text}</p>
                  </article>
                ))}
              </div>
            ) : <p className="text-muted-foreground">This home is ready for its first review.</p>}
          </section>

          <section className="space-y-4">
            <h2 className="text-3xl">Your host</h2>
            <div className="flex items-center gap-4">
              <UserAvatar user={host} className="size-16" />
              <div><h3 className="text-xl">{host.name}</h3><p className="text-sm text-muted-foreground">Hosting since June 2026 · Demo account</p></div>
            </div>
            <p className="text-sm text-muted-foreground">Arrival details are included with your reservation. If you need help with a stay, our support team can take a look.</p>
            <Button asChild variant="link" className="px-0"><Link href="/help">Contact support<ArrowRight /></Link></Button>
          </section>

          <section className="space-y-3">
            <h2 className="text-3xl">Good to know</h2>
            <ul className="grid gap-2 text-sm">
              <li>Check-in after 3 pm · Check-out by 11 am</li>
              <li>No smoking indoors · Quiet hours 10 pm to 8 am</li>
              <li>Up to {plural(home.sleeps, 'guest')} · {home.amenities.includes('Pet friendly') ? 'Pets welcome; please include them in your note to support.' : 'Please leave pets at home.'}</li>
            </ul>
            <h3 className="pt-2 text-xl">Cancellation</h3>
            <p className="text-sm text-muted-foreground">{policyText[home.cancellation_policy]} No refunds after check-in.</p>
          </section>
        </div>

        <aside>
          <SummaryCard className="sticky top-24">
            <div className="mb-5 flex items-baseline justify-between">
              <p><strong className="text-2xl font-semibold">{money(home.nightly_cents)}</strong> <span className="text-sm text-muted-foreground">/ weeknight</span></p>
              <Rating value={home.rating} />
            </div>
            {!bookable ? (
              <div className="grid gap-5">
                <Alert><AlertDescription>This home is not taking reservations. If you already have a stay here, it still stands; you’ll find it in Your trips.</AlertDescription></Alert>
                <Button asChild size="lg" variant="outline" className="w-full"><Link href={`/search?place=${encodeURIComponent(home.region)}`}>See homes in {home.region}<ArrowRight /></Link></Button>
              </div>
            ) : <>
            <form method="get" action={`/homes/${home.slug}`} className="grid gap-3">
              <DateRangeFields from={p.from} to={p.to} min={today()} />
              <div className="grid gap-1.5"><Label htmlFor="detail-guests">Guests</Label><GuestSelect id="detail-guests" value={p.guests} max={home.sleeps} /></div>
              <Button type="submit" variant="outline">Update dates</Button>
            </form>
            <Separator className="my-5" />
            {q.ok ? (
              <div className="grid gap-5">
                <PriceLines q={q.value} />
                <Button asChild size="lg" className="w-full"><Link href={bookingLink}>{home.instant_book ? 'Reserve this stay' : 'Request to book'}<ArrowRight /></Link></Button>
                <p className="text-center text-xs text-muted-foreground">You won’t be charged. This is a demo stay.</p>
              </div>
            ) : (
              <Alert variant="destructive"><AlertDescription>{q.error.message}</AlertDescription></Alert>
            )}
            </>}
          </SummaryCard>
        </aside>
      </div>
    </Page>
  );
}
