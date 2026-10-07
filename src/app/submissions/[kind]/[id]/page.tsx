"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHero, EmptyState } from "@/components/page-hero";
import { CheckCircle2, XCircle, ArrowLeft, Users, UserCheck, UserX, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

interface Answer { stem: string; type: string; given: string[]; correct: boolean; }
interface Row { id: string; mode: string; score: number; total: number; marksEarned?: number | null; marksTotal?: number; tookSecs?: number | null; createdAt: string; user: { name: string; email: string } | null; answers: Answer[]; }
interface Detail {
  title: string; kind: string;
  stats: { submitted: number; expected: number; attempts: number; avgScore: number | null; avgTookSecs: number | null };
  mine: Row[];
  all: Row[];
  notSubmitted: { id: string; name: string; role: string }[];
}

function fmtDur(secs?: number | null): string {
  if (secs == null) return "—";
  const m = Math.floor(secs / 60);
  return m ? `${m}m ${secs % 60}s` : `${secs}s`;
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" }) + " " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function modeLabel(m: string) {
  return m === "exam" ? "Test" : m === "selftest" ? "Self test" : "Practice";
}

export default function SubmissionDetail({ params }: { params: { kind: string; id: string } }) {
  const [d, setD] = useState<Detail | null>(null);
  const [gone, setGone] = useState(false);
  const [seg, setSeg] = useState<"all" | "missing" | "mine">("all");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const scope = params.kind === "set" ? "set" : "activity";
    fetch(`/api/submissions?scope=${scope}&id=${params.id}`).then(async (r) => {
      if (!r.ok) { setGone(true); return; }
      setD(await r.json());
    }).catch(() => setGone(true));
  }, [params.kind, params.id]);

  if (gone) return <div className="grid gap-3 py-10 text-center"><div className="font-bold">Not found or not yours.</div><a href="/bank" className="text-sm text-brand-600 underline">Back to bank</a></div>;
  if (!d) {
    return (
      <div className="grid gap-4">
        <div className="h-36 animate-pulse rounded-3xl bg-slate-100 dark:bg-white/[0.06]" />
        <div className="grid gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/[0.06]" />)}</div>
      </div>
    );
  }

  const s = d.stats;
  return (
    <div className="grid gap-4">
      <a href="/bank" className="w-fit"><Button variant="ghost" size="sm"><ArrowLeft className="h-3.5 w-3.5" /> Submissions</Button></a>
      <PageHero eyebrow={d.kind === "set" ? "Exam set submissions" : "Activity submissions"} title={d.title}
        description={`${s.submitted} of ${s.expected || "—"} people submitted · ${s.attempts} attempts${s.avgScore != null ? ` · avg ${s.avgScore}%` : ""}${s.avgTookSecs != null ? ` · avg ${fmtDur(s.avgTookSecs)}` : ""}`}
        tone="dark" />

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-soft dark:border-[var(--yrk-border-subtle)] dark:bg-[var(--yrk-surface-elevated)]">
        {([["all", `Submitted · ${s.submitted}`, Users], ["missing", `Not submitted · ${d.notSubmitted.length}`, UserX], ["mine", `Mine · ${d.mine.length}`, UserCheck]] as const).map(([v, l, Icon]) => (
          <button key={v} onClick={() => setSeg(v)}
            className={cn("flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-[13px] font-semibold transition", seg === v ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-500")}>
            <Icon className="h-4 w-4" />{l}
          </button>
        ))}
      </div>

      {seg === "all" && (
        <div className="grid gap-2">
          {!d.all.length && <EmptyState title="No submissions yet" hint="As candidates submit, rows land here." />}
          {d.all.map((r) => (
            <details key={r.id} className="group rounded-2xl border border-slate-200/80 bg-white shadow-soft open:shadow-lift dark:border-[var(--yrk-border-subtle)] dark:bg-[var(--yrk-surface-elevated)]"
              onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open ? r.id : null)}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3">
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{r.user?.name ?? "Someone"}</span>
                <Badge tone={r.mode === "exam" ? "merged" : "draft"}>{modeLabel(r.mode)}</Badge>
                <span className="text-sm font-black tabular-nums">{r.score}/{r.total}</span>
                {r.marksTotal ? <span className="text-xs text-slate-400">· {r.marksEarned ?? 0}/{r.marksTotal}</span> : null}
                <span className="flex items-center gap-1 text-xs text-slate-400"><Timer className="h-3.5 w-3.5" />{fmtDur(r.tookSecs)}</span>
                <span className="w-full text-xs text-slate-400 sm:ml-auto sm:w-auto">{fmtWhen(r.createdAt)}</span>
              </summary>
              <div className="grid gap-1 border-t border-slate-100 px-4 py-3 dark:border-[var(--yrk-border-subtle)]">
                {r.answers.map((x, i) => (
                  <div key={i} className={cn("flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-[13px]", x.correct ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200")}>
                    {x.correct ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                    <span className="min-w-0"><span className="font-medium">{x.stem.slice(0, 110)}</span>
                    <span className="text-slate-500"> — {x.given.join(", ") || "(blank)"}</span></span>
                  </div>
                ))}
                {!r.answers.length && <div className="text-[13px] text-slate-400">No answers recorded.</div>}
              </div>
            </details>
          ))}
        </div>
      )}

      {seg === "missing" && (
        <Card><CardContent className="grid gap-1.5 p-4">
          {!d.notSubmitted.length && <div className="text-sm text-slate-500">Everyone expected has submitted.</div>}
          {d.notSubmitted.map((p) => (
            <div key={p.id} className="flex items-center gap-2.5 rounded-xl border border-slate-100 px-3.5 py-2.5 text-sm dark:border-[var(--yrk-border-subtle)]">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-500 dark:bg-white/[0.07]">{p.name.charAt(0).toUpperCase()}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
              <Badge>{p.role}</Badge>
            </div>
          ))}
        </CardContent></Card>
      )}

      {seg === "mine" && (
        <div className="grid gap-2">
          {!d.mine.length && <EmptyState title="You haven't submitted here yet" hint="Play the activity and it lands here." />}
          {d.mine.map((r) => (
            <details key={r.id} className="group rounded-2xl border border-slate-200/80 bg-white shadow-soft open:shadow-lift dark:border-[var(--yrk-border-subtle)] dark:bg-[var(--yrk-surface-elevated)]">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3">
                <Badge tone={r.mode === "exam" ? "merged" : "draft"}>{modeLabel(r.mode)}</Badge>
                <span className="text-sm font-black tabular-nums">{r.score}/{r.total}</span>
                {r.marksTotal ? <span className="text-xs text-slate-400">· {r.marksEarned ?? 0}/{r.marksTotal} marks</span> : null}
                <span className="flex items-center gap-1 text-xs text-slate-400"><Timer className="h-3.5 w-3.5" />{fmtDur(r.tookSecs)}</span>
                <span className="ml-auto text-xs text-slate-400">{fmtWhen(r.createdAt)}</span>
              </summary>
              <div className="grid gap-1 border-t border-slate-100 px-4 py-3 dark:border-[var(--yrk-border-subtle)]">
                {r.answers.map((x, i) => (
                  <div key={i} className={cn("flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-[13px]", x.correct ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200")}>
                    {x.correct ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                    <span className="min-w-0"><span className="font-medium">{x.stem.slice(0, 110)}</span>
                    <span className="text-slate-500"> — {x.given.join(", ") || "(blank)"}</span></span>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
