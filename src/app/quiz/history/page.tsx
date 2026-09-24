"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHero, EmptyState } from "@/components/page-hero";
import { History, Target } from "lucide-react";

export default function HistoryPage() {
  const [data, setData] = useState<{ attempts: { id: string; mode: string; score: number; total: number }[]; weakAreas: Record<string, { correct: number; total: number; name: string }> }>({ attempts: [], weakAreas: {} });
  useEffect(() => { fetch("/api/quiz/attempts").then((r) => r.json()).then(setData); }, []);
  const weak = Object.values(data.weakAreas).sort((a, b) => (a.correct / a.total) - (b.correct / b.total));
  return (
    <div className="grid gap-5">
      <PageHero eyebrow="Progress" title="History & weak areas" description="Scores grouped by topic." />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><History className="h-4 w-4 text-indigo-600" />Attempts</CardTitle><CardDescription>Latest first, practice and mocks together.</CardDescription></CardHeader>
          <CardContent className="grid gap-2">
            {data.attempts.map((a) => {
              const pct = a.total ? Math.round((a.score / a.total) * 100) : 0;
              return (
                <div key={a.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3.5 py-2.5 text-sm">
                  <Badge tone={a.mode === "exam" ? "merged" : "draft"}>{a.mode}</Badge>
                  <span className="font-semibold">{a.score}/{a.total}</span>
                  <span className="text-slate-400">· {pct}%</span>
                  <span className="ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-slate-900" style={{ width: `${pct}%` }} /></span>
                </div>
              );
            })}
            {!data.attempts.length && <EmptyState title="No attempts yet" hint="Take a quiz first." action={<a href="/quiz"><Button size="sm">Take a quiz</Button></a>} />}
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-4 w-4 text-indigo-600" />Weak areas</CardTitle><CardDescription>Accuracy by topic, weakest first.</CardDescription></CardHeader>
          <CardContent className="grid gap-2">
            {weak.map((w) => {
              const pct = w.total ? Math.round((w.correct / w.total) * 100) : 0;
              return (
                <div key={w.name} className="rounded-xl border border-slate-100 px-3.5 py-2.5 text-sm">
                  <div className="flex items-center justify-between"><span className="font-semibold">{w.name}</span><span className="text-slate-500">{w.correct}/{w.total} · {pct}%</span></div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${pct < 50 ? "bg-rose-500" : pct < 75 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
            {!weak.length && <EmptyState title="No signal yet" hint="Take a quiz first." />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
