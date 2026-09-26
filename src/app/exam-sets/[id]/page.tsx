"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHero, EmptyState } from "@/components/page-hero";
import { toast } from "@/components/ui/toast";
import { ArrowUp, ArrowDown, X, Search, Play, Save } from "lucide-react";
import { fileIcon, typeLabel } from "@/components/drive-grid";

interface SetQuestion { id: string; stem: string; type: string; difficulty: string; }
interface ExamSet { id: string; title: string; institution: string; department: string; domain: string; level: string; term: string; subject: string; }

const DOMAINS = ["Not applicable", "Pre-Primary", "Elementary", "Primary", "Middle School", "Secondary", "High School", "Tertiary", "Professional"];
const TERMS = ["Not applicable", "First", "Second", "Third"];

export default function ExamSetBuilder({ params }: { params: { id: string } }) {
  const [set, setSet] = useState<ExamSet | null>(null);
  const [questions, setQuestions] = useState<SetQuestion[]>([]);
  const [q, setQ] = useState("");
  const [pool, setPool] = useState<SetQuestion[]>([]);
  const [dirty, setDirty] = useState(false);

  function load() {
    fetch(`/api/exam-sets/${params.id}`).then(async (r) => {
      if (!r.ok) { toast("Exam set not found."); window.location.href = "/exam-sets"; return; }
      const d = await r.json();
      setSet(d.set);
      setQuestions((d.questions ?? []).filter((x: SetQuestion) => x.type !== "missing"));
    });
  }
  useEffect(load, [params.id]);

  useEffect(() => {
    if (q.trim().length < 2) { setPool([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/bank?q=${encodeURIComponent(q)}&take=20`).then((r) => (r.ok ? r.json() : [])).then((d: SetQuestion[]) => {
        const inSet = new Set(questions.map((x) => x.id));
        setPool((Array.isArray(d) ? d : []).filter((x) => !inSet.has(x.id)));
      });
    }, 250);
    return () => clearTimeout(t);
  }, [q, questions]);

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= questions.length) return;
    const next = [...questions];
    [next[i], next[j]] = [next[j], next[i]];
    setQuestions(next); setDirty(true);
  }

  function add(x: SetQuestion) {
    setQuestions((xs) => [...xs, x]); setDirty(true);
  }

  function remove(i: number) {
    setQuestions((xs) => xs.filter((_, j) => j !== i)); setDirty(true);
  }

  async function save() {
    const res = await fetch(`/api/exam-sets/${params.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...set, questionIds: questions.map((x) => x.id) }) });
    const d = await res.json();
    if (!res.ok) { toast(d.error); return; }
    setSet(d); setDirty(false);
    toast(`Saved — ${questions.length} questions in order.`);
  }

  async function saveProfile(patch: Partial<ExamSet>) {
    const next = { ...set, ...patch } as ExamSet;
    setSet(next);
    const res = await fetch(`/api/exam-sets/${params.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (!res.ok) toast((await res.json()).error);
  }

  if (!set) return <div className="text-sm text-slate-500">Loading exam set…</div>;

  return (
    <div className="grid gap-5">
      <PageHero eyebrow={[set.domain, set.level, set.term].filter(Boolean).join(" · ") || "Exam set"} title={set.title}
        description={[set.institution, set.department, set.subject].filter(Boolean).join(" · ") || "Add a profile below."}
        actions={<>
          {!!questions.length && dirty && <Button variant="accent" onClick={save}><Save className="h-4 w-4" /> Save order ({questions.length})</Button>}
          {!!questions.length && !dirty && <>
            <a href={`/play?set=${set.id}&mode=practice`}><Button variant="outline" className="border-white/20 text-white hover:bg-white/10 hover:text-white">Practice</Button></a>
            <a href={`/play?set=${set.id}&mode=selftest`}><Button variant="outline" className="border-white/20 text-white hover:bg-white/10 hover:text-white">Self test</Button></a>
            <a href={`/play?set=${set.id}&mode=exam`}><Button variant="accent"><Play className="h-4 w-4" /> Test</Button></a>
          </>}
        </>} tone="dark" />

      <div className="grid items-start gap-5 lg:grid-cols-[320px_1fr]">
        <Card><CardHeader><CardTitle className="text-sm">Set profile</CardTitle><CardDescription>Autosaves per field.</CardDescription></CardHeader>
          <CardContent className="grid gap-2.5">
            <label className="yrk-label">Exam title<Input value={set.title} onChange={(e) => saveProfile({ title: e.target.value })} /></label>
            <label className="yrk-label">Institution<Input value={set.institution} onChange={(e) => saveProfile({ institution: e.target.value })} /></label>
            <label className="yrk-label">Department<Input value={set.department} onChange={(e) => saveProfile({ department: e.target.value })} /></label>
            <label className="yrk-label">Domain<Select value={set.domain} onChange={(e) => saveProfile({ domain: e.target.value })}>{DOMAINS.map((d) => <option key={d}>{d}</option>)}</Select></label>
            <label className="yrk-label">Level<Input value={set.level} onChange={(e) => saveProfile({ level: e.target.value })} placeholder="e.g. SSS II" /></label>
            <label className="yrk-label">Term / Semester<Select value={set.term} onChange={(e) => saveProfile({ term: e.target.value })}>{TERMS.map((t) => <option key={t}>{t}</option>)}</Select></label>
            <label className="yrk-label">Subject<Input value={set.subject} onChange={(e) => saveProfile({ subject: e.target.value })} /></label>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card><CardHeader><CardTitle className="text-sm">Add from the bank</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input className="pl-9" placeholder="Search stem… (2+ letters)" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              {pool.map((x) => {
                const Icon = fileIcon(x.type);
                return (
                  <div key={x.id} className="flex items-center gap-2.5 rounded-xl border border-slate-100 px-3 py-2 text-sm">
                    <Icon className="h-4 w-4 shrink-0 text-indigo-500" />
                    <span className="min-w-0 flex-1 truncate">{x.stem}</span>
                    <Badge>{typeLabel(x.type)}</Badge>
                    <Button size="sm" variant="outline" onClick={() => add(x)}>Add</Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card><CardHeader><CardTitle className="text-sm">Set order · {questions.length} question{questions.length === 1 ? "" : "s"}</CardTitle>
            <CardDescription>{dirty ? "Order changed — save before playing." : "Top plays first."}</CardDescription></CardHeader>
            <CardContent className="grid gap-2">
              {questions.length ? questions.map((x, i) => {
                const Icon = fileIcon(x.type);
                return (
                  <div key={x.id} className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm">
                    <span className="w-6 shrink-0 text-center font-bold tabular-nums text-slate-400">{i + 1}</span>
                    <Icon className="h-4 w-4 shrink-0 text-indigo-500" />
                    <span className="min-w-0 flex-1 truncate">{x.stem}</span>
                    <Badge>{typeLabel(x.type)}</Badge>
                    <button className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30" disabled={i === 0} title="Move up" onClick={() => move(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30" disabled={i === questions.length - 1} title="Move down" onClick={() => move(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Remove" onClick={() => remove(i)}><X className="h-3.5 w-3.5" /></button>
                  </div>
                );
              }) : <EmptyState title="Empty set" hint="Search the bank above and add questions." />}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
