"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHero, EmptyState } from "@/components/page-hero";
import { toast } from "@/components/ui/toast";
import { FileStack, Plus, Trash2, Play, ArrowRight, X } from "lucide-react";

interface ExamSet { id: string; title: string; institution: string; department: string; domain: string; level: string; term: string; subject: string; questionIds: string; }

const DOMAINS = ["Not applicable", "Pre-Primary", "Elementary", "Primary", "Middle School", "Secondary", "High School", "Tertiary", "Professional"];
const TERMS = ["Not applicable", "First", "Second", "Third"];

function countOf(s: ExamSet): number {
  try { const a = JSON.parse(s.questionIds || "[]"); return Array.isArray(a) ? a.length : 0; } catch { return 0; }
}

export default function ExamSetsPage() {
  const [sets, setSets] = useState<ExamSet[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [f, setF] = useState({ title: "", institution: "", department: "", domain: "Secondary", level: "", term: "First", subject: "" });

  function load() {
    fetch("/api/exam-sets").then((r) => (r.ok ? r.json() : [])).then((d) => setSets(Array.isArray(d) ? d : []));
  }
  useEffect(load, []);

  async function create() {
    if (!f.title.trim()) { toast("Exam title required."); return; }
    const res = await fetch("/api/exam-sets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const d = await res.json();
    if (!res.ok) { toast(d.error); return; }
    toast("Exam set created, add questions next.");
    window.location.href = `/exam-sets/${d.id}`;
  }

  async function remove(id: string, title: string) {
    if (!confirm(`Delete "${title}"? Questions stay in the bank.`)) return;
    const res = await fetch(`/api/exam-sets/${id}`, { method: "DELETE" });
    if (!res.ok) { toast((await res.json()).error); return; }
    toast("Exam set deleted.");
    load();
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <div className="grid gap-5">
      <PageHero eyebrow="Create Exam Set" title="Exam sets" description="Profile the exam (institution, domain, level, term), assemble ordered questions, then play it."
        actions={<Button variant="accent" onClick={() => setShowNew(true)}><Plus className="h-4 w-4" /> New exam set</Button>} tone="dark" />
      {sets.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {sets.map((s) => (
            <Card key={s.id} className="transition hover:shadow-lift">
              <CardContent className="grid gap-2 p-5">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50"><FileStack className="h-5 w-5 text-indigo-600" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{s.title}</div>
                    <div className="truncate text-[13px] text-slate-500">{[s.institution, s.department].filter(Boolean).join(" · ") || "No institution"}</div>
                  </div>
                  <button className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600" title="Delete" onClick={() => remove(s.id, s.title)}><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="text-[13px] text-slate-500">{[s.domain, s.level, s.term, s.subject].filter(Boolean).join(" · ") || "No profile yet"} · {countOf(s)} question{countOf(s) === 1 ? "" : "s"}</div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <a href={`/exam-sets/${s.id}`}><Button size="sm" variant="secondary">Open builder <ArrowRight className="h-3.5 w-3.5" /></Button></a>
                  {!!countOf(s) && <a href={`/play?set=${s.id}&mode=exam`}><Button size="sm"><Play className="h-3.5 w-3.5" /> Play as Test</Button></a>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : <EmptyState title="No exam sets yet" hint="Profile your first exam, then fill it with bank questions." action={<Button size="sm" onClick={() => setShowNew(true)}>New exam set</Button>} />}

      {showNew && (
        <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-slate-900/50 p-4" onClick={() => setShowNew(false)}>
          <div className="grid w-full max-w-lg gap-3 rounded-3xl bg-white p-5 shadow-lift" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><div className="font-bold">New exam set</div>
              <button onClick={() => setShowNew(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
            <label className="yrk-label">Exam title *<Input placeholder="e.g. SSS II Physics — First Term Exam" value={f.title} onChange={set("title")} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="yrk-label">Institution<Input placeholder="e.g. Yaba College" value={f.institution} onChange={set("institution")} /></label>
              <label className="yrk-label">Department<Input placeholder="e.g. Science" value={f.department} onChange={set("department")} /></label>
              <label className="yrk-label">Domain<Select value={f.domain} onChange={set("domain")}>{DOMAINS.map((d) => <option key={d}>{d}</option>)}</Select></label>
              <label className="yrk-label">Level<Input placeholder="e.g. SSS II / Year 2" value={f.level} onChange={set("level")} /></label>
              <label className="yrk-label">Term / Semester<Select value={f.term} onChange={set("term")}>{TERMS.map((t) => <option key={t}>{t}</option>)}</Select></label>
              <label className="yrk-label">Subject<Input placeholder="e.g. Physics" value={f.subject} onChange={set("subject")} /></label>
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button><Button variant="accent" onClick={create}>Create & add questions</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
