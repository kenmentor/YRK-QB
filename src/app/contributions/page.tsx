"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { PageHero, EmptyState } from "@/components/page-hero";
import { QuestionEditor, type QForm } from "@/components/question-editor";
import { toast } from "@/components/ui/toast";

interface Commit { id: string; status: string; message: string; adminMessage?: string; stem: string; subjectName: string; subjectId: string; payload: string; }

export default function CommitsPage() {
  const [items, setItems] = useState<Commit[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [topics, setTopics] = useState<{ id: string; name: string; subject: string; exam: string }[]>([]);
  const [note, setNote] = useState("");
  function load() {
    fetch("/api/proposals/mine").then((r) => (r.ok ? r.json() : [])).then(setItems);
    fetch("/api/topics").then((r) => (r.ok ? r.json() : [])).then(setTopics);
  }
  useEffect(load, []);

  function parsed(c: Commit) {
    try {
      return JSON.parse(c.payload) as {
        type: string; stem: string; options: string[]; correct: string[];
        parts?: { stem?: string; label?: string; max?: number }[];
        explanation: string; difficulty: string; difficultyIndex?: number;
        category?: string; sector?: string; tags?: string[]; mediaUrl?: string; topicId: string;
      };
    } catch { return null; }
  }

  async function save(id: string, f: QForm) {
    const res = await fetch(`/api/proposals/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payload: f, message: note }) });
    const d = await res.json();
    if (!res.ok) toast(d.error);
    else { toast("Commit updated."); setEditing(null); load(); }
  }

  async function withdraw(id: string) {
    if (!confirm("Withdraw this commit?")) return;
    const res = await fetch(`/api/proposals/${id}`, { method: "DELETE" });
    const d = await res.json();
    toast(res.ok ? "Withdrawn." : d.error);
    if (res.ok) load();
  }

  return (
    <div className="grid gap-5">
      <PageHero eyebrow="Mine" title="My commits" description="Everything you proposed, with admin verdicts. Pending ones stay editable." />
      {items.length ? items.map((c) => (
        <Card key={c.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={c.status === "pending" ? "in_review" : c.status === "committed" ? "approved" : "closed"}>{c.status}</Badge>
              <Badge>{c.subjectName}</Badge>
            </div>
            <CardTitle className="break-words text-[16px]">{c.stem}</CardTitle>
            {c.message && <CardDescription>Your note: “{c.message}”</CardDescription>}
            {c.adminMessage && <CardDescription>Admin: “{c.adminMessage}”</CardDescription>}
          </CardHeader>
          {c.status === "pending" && (
            <CardContent className="grid gap-2">
              {editing === c.id ? (
                (() => {
                  const p = parsed(c);
                  if (!p) return <div className="text-sm text-slate-500">Could not load payload.</div>;
                  return (<>
                    <Textarea placeholder="Note for the admin…" value={note} onChange={(e) => setNote(e.target.value)} />
                    <QuestionEditor key={c.id} topics={topics.filter((t) => t.subject === c.subjectName)} submitLabel="Save changes"
                      initial={{ type: p.type as QForm["type"], stem: p.stem, options: p.options, correct: p.correct, parts: p.parts ?? [], explanation: p.explanation, difficulty: p.difficulty, difficultyIndex: p.difficultyIndex ?? 3, category: p.category ?? "tertiary", sector: p.sector ?? "", tags: p.tags ?? [], mediaUrl: p.mediaUrl ?? "", topicId: p.topicId ?? "" }}
                      onSubmit={(f) => save(c.id, f)} />
                    <div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                    <Button variant="ghost" size="sm" className="text-red-600" onClick={() => withdraw(c.id)}>Withdraw</Button></div>
                  </>);
                })()
              ) : (
                <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setEditing(c.id)}>Edit</Button>
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => withdraw(c.id)}>Withdraw</Button></div>
              )}
            </CardContent>
          )}
        </Card>
      )) : <EmptyState title="No commits yet" hint="Propose from any subject." action={<a href="/bank"><Button size="sm">Find a subject</Button></a>} />}
    </div>
  );
}
