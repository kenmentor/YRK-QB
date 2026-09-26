import { PageHero } from "@/components/page-hero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TERMS } from "@/lib/terms";

export default function TermsPage() {
  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <PageHero eyebrow="House rules" title="Contribution terms" description="The short contract behind every shared question." />
      <Card><CardHeader><CardTitle>What you agree to</CardTitle></CardHeader>
        <CardContent className="grid gap-2.5 text-[15px]">
          {TERMS.map((t, i) => (
            <div key={i} className="flex gap-3 rounded-2xl border border-slate-100 dark:border-[var(--yrk-border-subtle)] px-4 py-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[13px] font-bold text-brand-700">{i + 1}</span>
              <span className="leading-relaxed text-slate-600 dark:text-[var(--yrk-text-secondary)]">{t}</span>
            </div>
          ))}
          <div className="mt-2 flex gap-2">
            <a href="/bank"><Button>Browse the bank</Button></a>
            <a href="/login"><Button variant="secondary">Login</Button></a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
