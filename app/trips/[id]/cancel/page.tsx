import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Page, Problem } from '@/components/site';
import { attempt, db, requireRole } from '@/lib/server';
import { dateLabel, money } from '@/lib/format';
import { guestBooking } from '../../../../src/domain/bookings.ts';
import { cancellationRefund, freeCancellationText, holidayWindowText, policyText } from '../../../../src/domain/cancellation.ts';
import { AppError } from '../../../../src/errors.ts';
import { today } from '../../../../src/config.ts';

export const metadata = { title: 'Cancel your reservation' };

export default async function CancelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole('guest', `/trips/${id}/cancel`);
  const found = attempt(() => guestBooking(db(), id, user));
  if (!found.ok) return <Problem error={found.error} />;
  const b = found.value;
  if (!(['confirmed', 'pending'].includes(b.status) && b.from_date >= today())) return <Problem error={new AppError(400, 'VALIDATION_ERROR', 'This reservation can no longer be cancelled online.')} />;
  const refund = cancellationRefund(b, today());
  const free = b.free_cancel_until && today() <= b.free_cancel_until;
  return (
    <Page className="max-w-2xl">
      <p className="eyebrow">Plans sometimes change</p>
      <h1 className="mt-3 text-5xl">Cancel this stay?</h1>
      <p className="mt-3 text-lg text-muted-foreground">{b.title} · {dateLabel(b.from_date)} – {dateLabel(b.to_date)}</p>
      <Card className="mt-8 rounded-2xl">
        <CardHeader>
          <CardDescription>Your refund</CardDescription>
          <CardTitle className="font-serif text-5xl text-primary">{money(refund)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">Of your {money(b.total_cents)} demo payment. Your reservation will be cancelled immediately.</p>
          <div className="space-y-2 rounded-xl bg-muted/70 p-4 text-sm">
            {free ? <p>{freeCancellationText} Yours runs until {dateLabel(b.free_cancel_until)}.</p> : null}
            <p>{policyText[b.policy as keyof typeof policyText]}</p>
            {b.holiday_refund_days ? <p>{holidayWindowText(b.holiday_refund_days)}</p> : null}
          </div>
          <form action={`/trips/${b.id}/cancel`} method="post" className="flex flex-wrap gap-3">
            <Button type="submit" variant="destructive">Confirm cancellation</Button>
            <Button asChild variant="outline"><Link href="/trips">Keep my stay</Link></Button>
          </form>
        </CardContent>
      </Card>
    </Page>
  );
}
