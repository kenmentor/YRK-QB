"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, Select } from "@/components/ui/input";
import { PageHero, EmptyState } from "@/components/page-hero";
import { Users, Plus, X } from "lucide-react";
import { toast } from "@/components/ui/toast";

interface Ws { id: string; name: string; focus: string; visibility?: string; myRole: string | null; memberCount: number; draftCount: number; }

export default function WorkspacesPage() {
  const [items, setItems] = useState<Ws[]>([]);
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<{ id: string; name: string; courses: { id: string; name: string; subjects: { id: string; name: string; topics: { id: string; name: string }[] }[] }[] }[]>([]);
  const [form, setForm] = useState({ name: "", focus: "", sessionId: "", courseId: "", subjectId: "", topicId: "", visibility: "invite-only" });
  function load() { fetch("/api/workspaces").then((r) => (r.ok ? r.json() : [])).then(setItems); }
  useEffect(load, []);
  useEffect(() => {
    if (open) fetch("/api/taxonomy/tree").then((r) => r.json()).then(setTree);
  }, [open]);
  const courses = tree.find((s) => s.id === form.sessionId)?.courses ?? [];
  const subjects = courses.find((c) => c.id === form.courseId)?.subjects ?? [];
  const topics = subjects.find((s) => s.id === form.subjectId)?.topics ?? [];
  async function create() {
    if (!form.name.trim()) { toast("Give the space a name first."); return; }
    const path = [form.sessionId && tree.find((s) => s.id === form.sessionId)?.name, form.courseId && courses.find((c) => c.id === form.courseId)?.name, form.subjectId && subjects.find((s) => s.id === form.subjectId)?.name, form.topicId && topics.find((t) => t.id === form.topicId)?.name].filter(Boolean).join(" › ");
    const res = await fetch("/api/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, focus: form.focus, examId: form.courseId || undefined, subjectId: form.subjectId || undefined, topicId: form.topicId || undefined, visibility: form.visibility }) });
    if (!res.ok) { toast("Login required to create a workspace."); return; }
    toast(path ? `Workspace created for ${path}.` : "Workspace created, invite your crew.");
    setOpen(false); setForm({ name: "", focus: "", sessionId: "", courseId: "", subjectId: "", topicId: "", visibility: "invite-only" }); load();
  }
  async function join(id: string, role: string) {
    const message = prompt(`Why do you want to join as ${role}? (message for the owner)`) ?? "";
    const res = await fetch(`/api/workspaces/${id}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, message }) });
    const d = await res.json();
    toast(res.ok ? "Request sent, the owner decides. Watch notifications." : d.error);
  }

  const mine = items.filter((w) => w.myRole);
  const owners = mine.filter((w) => w.myRole === "owner");
  const editors = mine.filter((w) => w.myRole === "editor");
  const reviewers = mine.filter((w) => w.myRole === "reviewer");
  const openSpaces = items.filter((w) => !w.myRole && w.visibility === "open");

  function cards(list: Ws[], empty: string) {
    if (!list.length) return <div className="text-sm text-slate-400 dark:text-[var(--yrk-text-tertiary)]">{empty}</div>;
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((w) => (
          <Card key={w.id} className="group transition hover:shadow-lift">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4 text-brand-600" />{w.name}</CardTitle>
                {w.myRole && <Badge tone={w.myRole === "owner" ? "approved" : "draft"}>{w.myRole}</Badge>}
                {w.visibility === "open" && <Badge tone="open">open</Badge>}
              </div>
              <CardDescription className="break-words">{w.focus} · {w.memberCount} members · {w.draftCount} drafts</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {w.myRole
                ? <a href={`/workspaces/${w.id}`}><Button variant="secondary" size="sm">Open space</Button></a>
                : (<><Button size="sm" variant="outline" onClick={() => join(w.id, "editor")}>Join as editor</Button>
                    <Button size="sm" variant="outline" onClick={() => join(w.id, "reviewer")}>Join as reviewer</Button></>)}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <PageHero eyebrow="Build together" title="Bank-creation workspaces"
        description="Small crews draft, professors review, owners publish."
        actions={<><Button variant="accent" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New workspace</Button><a href="/contributions"><Button variant="secondary">My commits</Button></a></>} tone="dark" />
      {open && (
        <div className="yrk-sheet yrk-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <Card className="yrk-modal max-h-[90dvh] w-full max-w-lg overflow-y-auto shadow-lift">
            <div onClick={(e) => e.stopPropagation()}>
              <CardHeader><div className="flex items-start justify-between"><div><CardTitle>New workspace</CardTitle></div><Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button></div></CardHeader>
              <CardContent className="grid gap-3">
                <label className="yrk-label">Space name<Input placeholder="e.g. WAEC Physics 2024, 50 Q set" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                <label className="yrk-label">Focus / goal<Textarea placeholder="What will this bank cover?" value={form.focus} onChange={(e) => setForm({ ...form, focus: e.target.value })} /></label>
                <div className="grid gap-2 rounded-xl bg-slate-50 dark:bg-[var(--yrk-surface-canvas)] p-3">
                  <span className="yrk-label">Attach to Session → Course → Subject → Topic</span>
                  <Select value={form.sessionId} onChange={(e) => setForm({ ...form, sessionId: e.target.value, courseId: "", subjectId: "", topicId: "" })}>
                    <option value="">Session</option>{tree.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                  {!!courses.length && <Select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value, subjectId: "", topicId: "" })}><option value="">Course</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}
                  {!!subjects.length && <Select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value, topicId: "" })}><option value="">Subject</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>}
                  {!!topics.length && <Select value={form.topicId} onChange={(e) => setForm({ ...form, topicId: e.target.value })}><option value="">Topic</option>{topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}
                </div>
                <label className="yrk-label">Visibility<Select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}><option value="invite-only">Invite-only (default)</option><option value="open">Open, anyone can request</option></Select></label>
                <div className="flex gap-2 pt-1"><Button variant="accent" onClick={create}>Create space</Button><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
              </CardContent>
            </div>
          </Card>
        </div>
      )}
      <section className="grid gap-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-[var(--yrk-text-tertiary)]">I own ({owners.length})</h2>
        {cards(owners, "No spaces yet, create one above.")}
      </section>
      <section className="grid gap-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-[var(--yrk-text-tertiary)]">I edit ({editors.length})</h2>
        {cards(editors, "Nothing here.")}
      </section>
      <section className="grid gap-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-[var(--yrk-text-tertiary)]">I review ({reviewers.length})</h2>
        {cards(reviewers, "Nothing here.")}
      </section>
      <section className="grid gap-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-[var(--yrk-text-tertiary)]">Open spaces, request to join ({openSpaces.length})</h2>
        {openSpaces.length ? cards(openSpaces, "") : <EmptyState title="No open spaces" hint="Invite-only spaces stay hidden until invited." />}
      </section>
    </div>
  );
}
