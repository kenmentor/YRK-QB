"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHero, EmptyState } from "@/components/page-hero";

export default function ProfilePage() {
  const [d, setD] = useState<{
    user: { name: string; email: string; role: string };
    status: { workspaces: number; draftsAuthored: number; reviewsDone: number; questionsCreated: number; attempts: number; accuracy: number };
    rank: { position: number; of: number; leaderboard: { id: string; name: string; score: number }[] };
    contributions: { drafts: { id: string; stem: string; status: string }[] };
    weakAreas: Record<string, { correct: number; total: number; name: string }>;
  } | null>(null);
  useEffect(() => {
    fetch("/api/profile/me").then((r) => {
      if (r.status === 401) { window.location.href = "/login"; return null; }
      return r.json();
    }).then((j) => j && setD(j));
  }, []);
  if (!d) return <div className="text-sm text-slate-500">Loading profile…</div>;
  const tier = d.status.questionsCreated >= 10 ? "Top contributor" : d.status.questionsCreated >= 3 ? "Active builder" : "Getting started";
  return (
    <div className="grid gap-5">
      <PageHero eyebrow={`${d.user.role} · rank #${d.rank.position} of ${d.rank.of}`} title={d.user.name} description={`${d.user.email} · ${tier}. Progress, contributions and focus areas live here.`} tone="dark" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader><CardTitle>Progress</CardTitle><CardDescription>Quiz form at a glance</CardDescription></CardHeader><CardContent><div className="text-2xl font-bold tracking-tight">{d.status.accuracy}%</div><div className="text-[13px] text-slate-500">{d.status.attempts} quizzes taken</div></CardContent></Card>
        <Card><CardHeader><CardTitle>Contributions</CardTitle><CardDescription>What you’ve built</CardDescription></CardHeader><CardContent><div className="text-2xl font-bold tracking-tight">{d.status.questionsCreated}</div><div className="text-[13px] text-slate-500">bank Qs · {d.status.draftsAuthored} drafts · {d.status.reviewsDone} reviews · {d.status.workspaces} spaces</div></CardContent></Card>
        <Card><CardHeader><CardTitle>Status</CardTitle><CardDescription>Where you stand</CardDescription></CardHeader><CardContent><div className="text-2xl font-bold tracking-tight">{tier}</div><div className="text-[13px] text-slate-500">Rank #{d.rank.position} of {d.rank.of}</div></CardContent></Card>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Leaderboard · top 5</CardTitle><CardDescription>Built from bank output + quiz form.</CardDescription></CardHeader>
        <CardContent className="grid gap-1.5 text-sm">{d.rank.leaderboard.map((l, i) => <div key={l.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3.5 py-2"><span className="font-medium">#{i + 1} {l.name}</span><span className="text-slate-400">{l.score} pts</span></div>)}</CardContent>
      </Card>
      <Card><CardHeader><CardTitle>My recent drafts</CardTitle><CardDescription>Latest work in spaces.</CardDescription></CardHeader>
        <CardContent className="grid gap-2 text-sm">{(d.contributions.drafts ?? []).map((x) => <div key={x.id} className="flex items-center gap-2 rounded-xl border border-slate-100 px-3.5 py-2.5"><span className="min-w-0 flex-1 break-words">{(x.stem ?? "").slice(0, 70)}</span> <Badge status={x.status} className="ml-auto shrink-0">{x.status}</Badge></div>)}{!(d.contributions.drafts ?? []).length && <EmptyState title="No drafts yet" hint="Join a workspace." action={<a href="/workspaces"><Button size="sm">Find a workspace</Button></a>} />}</CardContent>
      </Card>
      </div>
      <Card><CardHeader><CardTitle>Weak areas</CardTitle><CardDescription>Drill these next.</CardDescription></CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">{Object.values(d.weakAreas).map((w) => {
          const pct = w.total ? Math.round((w.correct / w.total) * 100) : 0;
          return <div key={w.name} className="rounded-xl border border-slate-100 px-3.5 py-2.5"><div className="flex justify-between"><span className="font-medium">{w.name}</span><span className="text-slate-400">{w.correct}/{w.total}</span></div><div className="mt-1.5 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-900" style={{ width: `${pct}%` }} /></div></div>;
        })}{!Object.keys(d.weakAreas).length && <EmptyState title="No signal yet" hint="Take a quiz first." />}</CardContent>
      </Card>
    </div>
  );
}
