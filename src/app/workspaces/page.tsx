"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { PageHero } from "@/components/page-hero";
import { Users, Plus, X } from "lucide-react";
import { toast } from "@/components/ui/toast";

export default function WorkspacesPage() {
  const [items, setItems] = useState<{ id: string; name: string; focus: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<{ id: string; name: string; courses: { id: string; name: string; subjects: { id: string; name: string; topics: { id: string; name: string }[] }[] }[] }[]>([]);
  const [form, setForm] = useState({ name: "", focus: "", sessionId: "", courseId: "", subjectId: "", topicId: "", visibility: "invite-only" });
  function load() { fetch("/api/workspaces").then((r) => r.json()).then(setItems); }
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
    const res = await fetch("/api/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, focus: `${form.focus}${path ? ` [${path}]` : ""} [${form.visibility}]`, examId: form.courseId || undefined }) });
    if (!res.ok) { toast("Login required to create a workspace."); return; }
    toast(path ? `Workspace created for ${path}.` : "Workspace created, invite your crew.");
    setOpen(false); setForm({ name: "", focus: "", sessionId: "", courseId: "", subjectId: "", topicId: "", visibility: "invite-only" }); load();
  }
  return (
    <div className="grid gap-5">
      <PageHero eyebrow="Build together" title="Bank-creation workspaces"
        description="Small crews draft, professors review, owners publish."
        actions={<Button variant="accent" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New workspace</Button>} tone="dark" />
      {open && (
        <div className="yrk-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <Card className="yrk-modal max-h-[90dvh] w-full max-w-lg overflow-y-auto shadow-lift">
            <div onClick={(e) => e.stopPropagation()}>
              <CardHeader><div className="flex items-start justify-between"><div><CardTitle>New workspace</CardTitle></div><Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button></div></CardHeader>
              <CardContent className="grid gap-3">
                <label className="yrk-label">Space name<Input placeholder="e.g. WAEC Physics 2024, 50 Q set" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                <label className="yrk-label">Focus / goal<Textarea placeholder="What will this bank cover?" value={form.focus} onChange={(e) => setForm({ ...form, focus: e.target.value })} /></label>
                <div className="grid gap-2 rounded-xl bg-slate-50 p-3">
                  <span className="yrk-label">Attach to Session → Course → Subject → Topic</span>
                  <Select value={form.sessionId} onChange={(e) => setForm({ ...form, sessionId: e.target.value, courseId: "", subjectId: "", topicId: "" })}>
                    <option value="">Session</option>{tree.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                  {!!courses.length && <Select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value, subjectId: "", topicId: "" })}><option value="">Course</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}
                  {!!subjects.length && <Select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value, topicId: "" })}><option value="">Subject</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>}
                  {!!topics.length && <Select value={form.topicId} onChange={(e) => setForm({ ...form, topicId: e.target.value })}><option value="">Topic</option>{topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}
                </div>
                <label className="yrk-label">Visibility<Select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}><option value="invite-only">Invite-only (default)</option><option value="open">Open, anyone with link</option></Select></label>
                <div className="flex gap-2 pt-1"><Button variant="accent" onClick={create}>Create space</Button><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
              </CardContent>
            </div>
          </Card>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((w) => (
          <Card key={w.id} className="group transition hover:shadow-lift">
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-4 w-4 text-indigo-600" />{w.name}</CardTitle><CardDescription>{w.focus}</CardDescription></CardHeader>
            <CardContent><a href={`/workspaces/${w.id}`}><Button variant="secondary" size="sm" className="opacity-90 group-hover:opacity-100">Open space</Button></a></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
