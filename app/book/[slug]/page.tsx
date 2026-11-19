import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { ArrowRight, CalendarDays, ChevronLeft, Users } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { DemoCardField } from '@/components/forms';
import { Page } from '@/components/site';
import { PriceLines, SummaryCard } from '@/components/stay';
import { attempt, currentUser, db, flag, homeBySlug, toURLSearchParams, type SearchParams } from '@/lib/server';
import { capitalize, dateLabel, fullDate, money, plural } from '@/lib/format';
import { stayParams } from '../../../src/stay.ts';
import { quote } from '../../../src/domain/bookings.ts';
import { freeCancellationText, holidayWindowText, policyText } from '../../../src/domain/cancellation.ts';

export const metadata = { title: 'Confirm your stay' };

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5 border-b pb-8">
      <h2 className="flex items-center gap-3 text-2xl"><span className="grid size-8 place-items-center rounded-full bg-primary font-sans text-sm font-semibold text-primary-foreground">{n}</span>{title}</h2>
      {children}
    </section>
  );
}

export default async function Checkout({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: SearchParams }) {
  const home = homeBySlug((await params).slug);
  const search = toURLSearchParams(await searchParams);
  const user = await currentUser();
  const canBook = user?.role === 'guest';
  const result = attempt(() => { const p = stayParams(search); return { p, q: quote(db(), home.slug, p.from, p.to, p.guests) }; });
  const back = `/homes/${home.slug}?${search}`;
  if (!result.ok) {
    return (
      <Page className="max-w-3xl">
        <Alert variant="destructive"><AlertTitle>These dates aren’t available.</AlertTitle><AlertDescription>{result.error.message}</AlertDescription></Alert>
        <Button asChild variant="outline" className="mt-6"><Link href={back}><ChevronLeft />Back to {home.title}</Link></Button>
      </Page>
    );
  }
  const { p, q } = result.value;
  const instant = Boolean(home.instant_book) && flag('instant_booking');
  const here = `/book/${home.slug}?${search}`;
  return (
    <Page className="pt-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2"><Link href={back}><ChevronLeft />Back to {home.title}</Link></Button>
      <div className="mt-6 grid grid-cols-1 gap-12 lg:grid-cols-[1fr_400px]">
        <div className="space-y-8">
          <div className="space-y-3">
            <p className="eyebrow">One step closer to away</p>
            <h1 className="text-4xl sm:text-5xl">Make it your next stay.</h1>
            <p className="text-muted-foreground">Review the details. We’ll take care of the little things.</p>
          </div>
          {!canBook ? (
            <Alert><AlertTitle>Sign in as a guest to book</AlertTitle><AlertDescription><span>Choose a guest account with <Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/signin?next=${encodeURIComponent(here)}`}>demo sign-in</Link> to complete this reservation.</span></AlertDescription></Alert>
          ) : null}
          <form method="post" action={`/book/${home.slug}`} className="space-y-8">
            <input type="hidden" name="slug" value={home.slug} />
            <input type="hidden" name="from" value={p.from} />
            <input type="hidden" name="to" value={p.to} />
            <input type="hidden" name="guests" value={p.guests} />
            <input type="hidden" name="idempotencyKey" value={randomUUID()} />
            <Step n={1} title="Your little escape">
              <div className="grid grid-cols-2 gap-4 rounded-xl bg-muted/60 p-4 text-sm">
                <div><p className="text-muted-foreground">Dates</p><p className="font-medium">{fullDate(p.from)}<br />to {fullDate(p.to)}</p></div>
                <div><p className="text-muted-foreground">Guests</p><p className="font-medium">{plural(p.guests, 'guest')}</p></div>
              </div>
            </Step>
            <Step n={2} title="Who’s coming?">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5"><Label htmlFor="guest-name">Guest name</Label><Input id="guest-name" name="guestName" defaultValue={canBook ? user.name : ''} required maxLength={100} autoComplete="name" /></div>
                <div className="grid gap-1.5"><Label htmlFor="guest-email">Email for your confirmation</Label><Input id="guest-email" type="email" name="guestEmail" defaultValue={canBook ? user.email : ''} required maxLength={254} autoComplete="email" /></div>
              </div>
            </Step>
            <Step n={3} title="Demo payment"><DemoCardField /></Step>
            <Step n={4} title="A few things to know">
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>{freeCancellationText} {policyText[home.cancellation_policy]} No refunds after check-in.</p>
                {q.holidayRefundDays ? <p>{holidayWindowText(q.holidayRefundDays)}</p> : null}
                <p>Check-in after 3 pm, check-out by 11 am. No smoking indoors. This entire marketplace uses fictional homes and accounts.</p>
              </div>
              <Label className="-mx-2 cursor-pointer rounded-lg px-2 py-2.5 font-normal hover:bg-muted/60"><Checkbox name="agree" value="1" required />I’ve reviewed the house rules and cancellation policy.</Label>
            </Step>
            <div className="space-y-3">
              <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={!canBook}>
                {instant ? 'Confirm demo booking' : 'Send reservation request'} · {money(q.totalCents)}<ArrowRight />
              </Button>
              <p className="text-center text-xs text-muted-foreground">{instant ? 'Instant confirmation.' : 'Your host will review your request.'} No actual payment is processed.</p>
            </div>
          </form>
        </div>
        <aside>
          <SummaryCard className="sticky top-24">
            <img src={home.photos[0]} alt={home.title} width={1200} height={800} className="mb-5 aspect-[3/2] w-full rounded-xl object-cover" />
            <h2 className="text-2xl">{home.title}</h2>
            <p className="text-sm text-muted-foreground">{home.neighbourhood} · {home.region}</p>
            <div className="mt-4 grid gap-2 text-sm">
              <span className="flex items-center gap-2"><CalendarDays className="size-4 text-primary" />{dateLabel(p.from)} – {dateLabel(p.to)} · {plural(q.nights, 'night')}</span>
              <span className="flex items-center gap-2"><Users className="size-4 text-primary" />{plural(p.guests, 'guest')} · Entire home</span>
            </div>
            <Separator className="my-5" />
            <PriceLines q={q} />
            <p className="mt-5 text-xs text-muted-foreground">{capitalize(home.cancellation_policy)} cancellation. Full details are shown before you book.</p>
          </SummaryCard>
        </aside>
      </div>
    </Page>
  );
}
