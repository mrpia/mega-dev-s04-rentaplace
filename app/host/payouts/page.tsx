import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pager } from '@/components/pager';
import { Page, PageHeading, StatusBadge } from '@/components/site';
import { db, param, requireRole, type SearchParams } from '@/lib/server';
import { dateLabel, fullDate, money, plural } from '@/lib/format';
import { hostPayouts } from '../../../src/domain/payouts.ts';

export const metadata = { title: 'Payouts' };

type Payout = { id: string; reference: string; title: string; scheduled_date: string; paid_date: string | null; status: string; amount_cents: number };

export default async function HostPayouts({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const user = await requireRole('host', '/host/payouts');
  const data = hostPayouts(db(), user.id) as { items: Payout[]; scheduledCents: number; paidCents: number };
  const page = Math.max(1, Number(param(sp, 'page') || 1));
  const pages = Math.max(1, Math.ceil(data.items.length / 30));
  const items = data.items.slice((page - 1) * 30, page * 30);
  return (
    <Page>
      <PageHeading
        eyebrow="A clear picture of your earnings"
        title="Good stays add up."
        description="Host share is accommodation, any holiday surcharge and cleaning, less a 3% platform fee."
        actions={<Button asChild variant="outline"><a href="/host/payouts.csv"><Download />Export CSV</a></Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {[['Scheduled payouts', data.scheduledCents, 'Scheduled for the day after check-in'], ['Paid to date', data.paidCents, 'Demo payouts · no bank transfers']].map(([label, cents, note]) => (
          <Card key={label as string} className="gap-2 rounded-2xl bg-topo">
            <CardHeader><CardDescription className="eyebrow text-[11px] text-muted-foreground">{label as string}</CardDescription></CardHeader>
            <CardContent><p className="font-serif text-4xl">{money(cents as number)}</p><p className="mt-1 text-xs text-muted-foreground">{note as string}</p></CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-8 mb-3 text-sm text-muted-foreground">{plural(data.items.length, 'payout')} · Page {page} of {pages}</p>
      <Card className="overflow-hidden rounded-2xl py-0">
        <Table>
          <TableHeader className="bg-muted/50"><TableRow><TableHead className="pl-5">Reservation</TableHead><TableHead>Home</TableHead><TableHead>Scheduled</TableHead><TableHead>Paid</TableHead><TableHead>Status</TableHead><TableHead className="pr-5 text-right">Your share</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="pl-5 font-mono text-xs">{p.reference}</TableCell>
                <TableCell>{p.title}</TableCell>
                <TableCell>{fullDate(p.scheduled_date)}</TableCell>
                <TableCell>{p.paid_date ? dateLabel(p.paid_date) : '—'}</TableCell>
                <TableCell><StatusBadge status={p.status} /></TableCell>
                <TableCell className="pr-5 text-right font-medium tabular-nums">{money(p.amount_cents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Pager page={page} pages={pages} label="Payout pages" href={(n) => `/host/payouts?page=${n}`} />
    </Page>
  );
}
