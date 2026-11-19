import { ArrowRight } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Page } from '@/components/site';
import { currentUser, flag, param, type SearchParams } from '@/lib/server';

export const metadata = { title: 'A little help' };

const FAQ: [string, string][] = [
  ['How do demo payments work?', 'Use the test card 4242 4242 4242 4242 at checkout. No real money moves and the card number is never saved. Confirmation emails are written locally, not sent.'],
  ['How do I cancel my stay?', 'Open Your trips, choose a reservation, and select Cancel. You’ll see the refund before you confirm. Until the day after you reserve, cancelling is free: a full refund, service fee included. After that the amount depends on the home’s policy, any holiday refund window the host set, and how far away check-in is.'],
  ['When do hosts receive a payout?', 'Payouts are scheduled for the day after check-in. The host share is the accommodation, any holiday surcharge and the cleaning fee, less a 3% platform fee. The payouts page includes a CSV export.'],
  ['What are weekend rates?', 'Friday and Saturday nights use the home’s weekend rate. Your price breakdown shows each group of nights before you book.'],
  ['Are these real homes?', 'This is a local demo marketplace. All listings, accounts, reviews, and reservations are fictional. Home photos are AI-generated and illustrative.'],
];

export default async function HelpPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await currentUser();
  const received = param(await searchParams, 'received');
  return (
    <>
      <section className="relative isolate overflow-hidden">
        <img src="/img/scenes/help.jpg" alt="" width={1600} height={900} fetchPriority="high" className="absolute inset-0 -z-10 size-full object-cover" />
        <div className="hero-wash absolute inset-0 -z-10" />
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-xl space-y-3">
            <p className="eyebrow">We’re here when you need us</p>
            <h1 className="text-5xl">A little help goes a long way.</h1>
            <p className="text-lg text-foreground/80">Questions about a stay, your home, or what happens next? Start here.</p>
          </div>
        </div>
      </section>
      <Page>
        {received ? (
          <Alert className="mb-8 border-primary/30 bg-secondary"><AlertTitle>Thank you. We’ve got it.</AlertTitle><AlertDescription>We’ve received your request. Your reference is {received}.</AlertDescription></Alert>
        ) : null}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_440px]">
          <div>
            <h2 className="mb-4 text-3xl">Good questions, clear answers.</h2>
            <Accordion type="single" collapsible className="rounded-2xl border bg-card px-5">
              {FAQ.map(([q, a], i) => (
                <AccordionItem key={q} value={`item-${i}`}>
                  <AccordionTrigger className="text-base">{q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="font-serif text-3xl font-normal">Let’s take a look.</CardTitle></CardHeader>
            <CardContent>
              <form method="post" action="/help" className="grid gap-4">
                <div className="grid gap-1.5"><Label htmlFor="help-name">Your name</Label><Input id="help-name" name="name" autoComplete="name" defaultValue={user?.name} maxLength={100} required /></div>
                <div className="grid gap-1.5"><Label htmlFor="help-email">Email</Label><Input id="help-email" name="email" type="email" autoComplete="email" defaultValue={user?.email} maxLength={254} required /></div>
                <div className="grid gap-1.5"><Label htmlFor="help-subject">What can we help with?</Label><Input id="help-subject" name="subject" maxLength={160} required placeholder="A short summary of your question" /></div>
                <div className="grid gap-1.5"><Label htmlFor="help-message">Tell us a little more</Label><Textarea id="help-message" name="message" rows={5} maxLength={5000} required placeholder="Include your reservation reference if you have one." /></div>
                <Button type="submit" size="lg" disabled={!flag('support_form')}>Send your question<ArrowRight /></Button>
                <p className="text-xs text-muted-foreground">Please don’t include card numbers or other sensitive information.</p>
              </form>
            </CardContent>
          </Card>
        </div>
      </Page>
    </>
  );
}
