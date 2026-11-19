import Link from 'next/link';
import { Star, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { dateLabel, fullDate, money, plural } from '@/lib/format';
import { addDays, today } from '../../src/config.ts';
import type { Listing, Quote } from '../../src/types.ts';

export function Rating({ value, count, className }: { value: number; count?: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm font-medium', className)}>
      <Star className="size-3.5 fill-primary text-primary" aria-hidden />
      {value ? value.toFixed(2) : 'New'}
      {count !== undefined ? <span className="font-normal text-muted-foreground">({count})</span> : null}
    </span>
  );
}

export function stayQuery(q: { from?: string; to?: string; guests?: number | string } = {}) {
  const from = q.from || addDays(today(), 1);
  return new URLSearchParams({ from, to: q.to || addDays(from, 3), guests: String(q.guests || 2) });
}

export function HomeCard({ home, q, priority }: { home: Listing; q?: { from?: string; to?: string; guests?: number }; priority?: boolean }) {
  return (
    <Link href={q ? `/homes/${home.slug}?${stayQuery(q)}` : `/homes/${home.slug}`} className="group block rounded-2xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
      <div className="relative aspect-[3/2] overflow-hidden rounded-2xl bg-muted">
        <img
          src={home.photos[0]}
          alt={home.title}
          width={1200}
          height={800}
          loading={priority ? 'eager' : 'lazy'}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {home.instant_book ? (
          <Badge className="absolute top-3 left-3 rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur"><Zap className="text-primary" />Instant booking</Badge>
        ) : null}
      </div>
      <div className="space-y-0.5 px-0.5 pt-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-sans text-[15px] font-semibold tracking-normal">{home.title}</h3>
          <Rating value={home.rating} />
        </div>
        <p className="text-sm text-muted-foreground">{home.region}</p>
        <p className="text-sm text-muted-foreground">{plural(home.sleeps, 'guest')} · {home.bedrooms === 0 ? 'Studio' : plural(home.bedrooms, 'bedroom')}</p>
        <p className="pt-1 text-sm"><strong className="font-semibold">{money(home.nightly_cents)}</strong> / night <span className="text-muted-foreground">before fees</span></p>
      </div>
    </Link>
  );
}

function Line({ label, value, className }: { label: React.ReactNode; value: string; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 text-sm', className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function PriceLines({ q }: { q: Quote }) {
  return (
    <div className="grid gap-2.5">
      {q.weeknightNights ? <Line label={`${plural(q.weeknightNights, 'weeknight')} × ${money(q.weeknightCents)}`} value={money(q.weeknightNights * q.weeknightCents)} /> : null}
      {q.weekendNights ? <Line label={`${q.weekendNights} weekend ${q.weekendNights === 1 ? 'night' : 'nights'} × ${money(q.weekendCents)}`} value={money(q.weekendNights * q.weekendCents)} /> : null}
      {q.surchargeCents ? <Line label={`Holiday surcharge: ${q.surchargePercent}% on ${q.holidayNights} ${q.holidayNights === 1 ? 'night' : 'nights'}`} value={money(q.surchargeCents)} /> : null}
      <Line label="Cleaning fee" value={money(q.cleaningCents)} />
      <Separator />
      <Line label="Subtotal before fees & tax" value={money(q.subtotalCents)} className="font-medium [&>span:first-child]:text-foreground" />
      <Line label="Service fee (12%)" value={money(q.serviceFeeCents)} />
      <Line label="Occupancy tax (8%)" value={money(q.taxCents)} />
      <Separator />
      <div className="flex items-baseline justify-between text-base font-semibold">
        <span>Total <span className="text-xs font-normal text-muted-foreground">USD</span></span>
        <span className="tabular-nums">{money(q.totalCents)}</span>
      </div>
    </div>
  );
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_STYLES: Record<string, string> = {
  available: 'bg-card text-foreground ring-1 ring-border',
  booked: 'bg-primary/85 text-primary-foreground',
  blocked: 'bg-muted text-muted-foreground line-through',
  pending: 'bg-pending/60 text-foreground',
};

export function MonthGrid({ calendar }: { calendar: { month: string; days: { date: string; status: string }[] } }) {
  const offset = new Date(`${calendar.month}-01T12:00:00Z`).getUTCDay();
  return (
    <div className="grid grid-cols-7 gap-1.5 text-center text-sm">
      {WEEKDAYS.map((day) => <span key={day} aria-label={day} className="pb-1 text-xs font-medium text-muted-foreground">{day[0]}</span>)}
      {Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} />)}
      {calendar.days.map((d) => (
        <span
          key={d.date}
          aria-label={`${fullDate(d.date)}, ${d.status}`}
          className={cn('grid aspect-square place-items-center rounded-lg tabular-nums', DAY_STYLES[d.status] ?? DAY_STYLES.blocked, d.date === today() && 'ring-2 ring-ring')}
        >
          {Number(d.date.slice(-2))}
        </span>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
      {items.map(([status, label]) => (
        <span key={status} className="inline-flex items-center gap-2"><i className={cn('size-3 rounded', DAY_STYLES[status])} />{label}</span>
      ))}
    </div>
  );
}

export function StayDates({ from, to, nights }: { from: string; to: string; nights?: number }) {
  return <span>{dateLabel(from)} – {dateLabel(to)}{nights ? ` · ${plural(nights, 'night')}` : ''}</span>;
}

export function SummaryCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Card className={cn('gap-0 rounded-2xl py-0 shadow-sm', className)}><CardContent className="p-6">{children}</CardContent></Card>;
}
