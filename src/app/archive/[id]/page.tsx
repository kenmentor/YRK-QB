"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { Banner } from "@/components/activity-banner";
import { ArrowLeft, Play, CheckCircle2, Pencil } from "lucide-react";
import { useSession } from "@/lib/use-session";
import { cn } from "@/lib/utils";

interface Meta {
  id: string; ownerId: string; title: string; banner: string; details: string;
  rulesPractice: string; rulesTest: string; modes: string[];
  category: string; sector: string;
  ownerName: string; contributors: { id: string; name: string }[]; questionCount: number;
  role: string | null;
}

const MODE_LABEL: Record<string, string> = { practice: "Practice", selftest: "Self test", exam: "Test" };
const CAT_LABEL: Record<string, string> = {
  primary: "Primary", secondary: "Secondary", tertiary: "Tertiary",
  professional: "Professional", other: "Other",
};
function catLabel(c?: string) {
  return (c && CAT_LABEL[c]) || c || "Tertiary";
}

export default function ActivityPage({ params }: { params: { id: string } }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [mode, setMode] = useState<string>("practice");
  const [accepted, setAccepted] = useState(false);
  const { user: me, loaded: authLoaded } = useSession();
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("mode");
    if (m === "practice" || m === "selftest" || m === "exam") setMode(m);
    fetch(`/api/activities/${params.id}`).then(async (r) => {      if (!r.ok) { setGone(true); return; }
      const d = await r.json();
      setMeta(d.meta);
      const modes = d.meta.modes as string[];
      setMode((m) => (modes.includes(m) ? m : modes[0] ?? "practice"));
    });
  }, [params.id]);

  if (gone) return <div className="grid gap-3 py-10 text-center"><div className="font-bold">Artifact not found or private.</div><a href="/archive" className="text-sm text-indigo-600 underline">Back to archive</a></div>;
  if (!meta) {
    return (
      <div className="grid gap-5">
        <div className="h-36 animate-pulse rounded-3xl bg-slate-100" />
        <div className="grid gap-2">
          <div className="h-6 w-2/3 animate-pulse rounded-md bg-slate-100" />
          <div className="h-4 w-full animate-pulse rounded-md bg-slate-100" />
          <div className="h-4 w-1/2 animate-pulse rounded-md bg-slate-100" />
        </div>
        <div className="h-48 animate-pulse rounded-3xl bg-slate-100" />
      </div>
    );
  }

  const rules = mode === "exam" ? meta.rulesTest : meta.rulesPractice;

  function start() {
    if (!accepted) { toast("Read and accept the rules first."); return; }
    if (!meta) return;
    if (!me) { window.location.href = `/login?next=${encodeURIComponent(`/archive/${meta.id}`)}`; return; }
    window.location.href = `/play?activity=${meta.id}&mode=${mode}`;
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-2">
        <a href="/archive" className="w-fit"><Button variant="ghost" size="sm"><ArrowLeft className="h-3.5 w-3.5" /> Archive</Button></a>
        {(meta.role === "owner" || meta.role === "editor") && (
          <a href={`/activities/${meta.id}`} className="ml-auto"><Button variant="outline" size="sm"><Pencil className="h-3.5 w-3.5" /> Edit in builder</Button></a>
        )}
      </div>
      <Card className="overflow-hidden">
        <Banner preset={meta.banner} title={meta.title} className="h-36" />
        <CardContent className="grid gap-2 p-5 sm:p-6">
          <h1 className="text-2xl font-bold tracking-tight">{meta.title}</h1>
          <div className="text-sm text-slate-500">
            by <span className="font-semibold text-slate-700">{meta.ownerName}</span>
            {!!meta.contributors.length && <> · contributors: {meta.contributors.map((c) => c.name).join(", ")}</>}
          </div>
          {meta.details && <p className="max-w-2xl text-[15px] leading-relaxed text-slate-600">{meta.details}</p>}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge>{meta.questionCount} questions</Badge>
            <Badge tone="draft">{catLabel(meta.category)}{meta.sector ? ` · ${meta.sector}` : ""}</Badge>
            {meta.modes.map((m) => <Badge key={m} tone="draft">{MODE_LABEL[m] ?? m}</Badge>)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-3 p-5 sm:p-6">
          <div className="text-sm font-bold">How do you want to play it?</div>
          <div className="flex flex-wrap gap-2">
            {meta.modes.map((m) => (
              <Button key={m} variant={mode === m ? "default" : "outline"} onClick={() => { setMode(m); setAccepted(false); }}>{MODE_LABEL[m] ?? m}</Button>
            ))}
          </div>
          <div className={cn("grid gap-2 rounded-2xl border p-4", accepted ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 bg-slate-50")}>
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
              {mode === "exam" ? "Test rules — set by the owner" : "Practice rules — set by the owner"}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{rules}</p>
            <label className="flex cursor-pointer items-start gap-2.5 pt-1 text-sm">
              <button onClick={() => setAccepted((a) => !a)} className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs font-bold transition", accepted ? "border-emerald-600 bg-emerald-500 text-white" : "border-slate-300 bg-white text-transparent hover:border-emerald-500")}>✓</button>
              <span>I have read the rules{mode === "exam" ? " and accept the strict clock" : ""}.</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="accent" size="lg" onClick={start} disabled={!accepted || !authLoaded}><Play className="h-4 w-4" /> {!authLoaded ? "Loading…" : me ? `Start ${MODE_LABEL[mode]}` : "Log in & start"}</Button>
            {authLoaded && !me && <span className="self-center text-[13px] text-slate-400">Rounds record to your history, so an account is needed to play.</span>}
            {accepted && me && <span className="flex items-center gap-1 self-center text-[13px] text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Rules accepted</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
