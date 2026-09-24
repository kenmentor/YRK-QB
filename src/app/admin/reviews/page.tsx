"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { PageHero, EmptyState } from "@/components/page-hero";
import { toast } from "@/components/ui/toast";

interface Proposal { id: string; kind: string; payload: string; message: string; status: string; contributor: { name: string; email: string } | null; subject: { name: string } | null; }

export default function AdminReviews() {
  const [items, setItems] = useState<Proposal[]>([]);
  const [queue, setQueue] = useState<{ id: string; kind: string; name: string; normName: string }[]>([]);
  const [msg, setMsg] = useState<Record<string, string>>({});
  function load() {
    fetch("/api/proposals?status=pending").then((r) => (r.ok ? r.json() : [])).then(setItems);
    fetch("/api/taxonomy/proposals").then((r) => (r.ok ? r.json() : [])).then(setQueue);
  }
  useEffect(load, []);

  async function decideTaxonomy(id: string, decision: "approve" | "reject") {
    const res = await fetch(`/api/taxonomy/proposals/${id}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) });
    const d = await res.json();
    toast(res.ok ? (d.note ?? `Taxonomy ${decision}d.`) : d.error);
    load();
  }

  async function decide(id: string, decision: "commit" | "cancel") {
    const message = msg[id] ?? "";
    const res = await fetch(`/api/proposals/${id}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, message }) });
    const d = await res.json();
    if (!res.ok) { toast(d.error); return; }
    toast(decision === "commit" ? (message ? "Committed + message sent." : "Committed to the bank.") : (message ? "Cancelled + message sent." : "Cancelled with default note."));
    load();
  }

  return (
    <div className="grid gap-5">
      <PageHero eyebrow="Admin" title="Review contributions" description="Commit, cancel with a message, or cancel quietly." tone="dark" />
      {items.length ? items.map((p) => {
        const q = JSON.parse(p.payload) as { stem: string; type: string; difficulty: string; explanation: string };
        return (
          <Card key={p.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2"><Badge tone="in_review">{p.status}</Badge><Badge>{p.subject?.name}</Badge><span className="text-xs text-slate-400">by {p.contributor?.name} · {p.kind}</span></div>
              <CardTitle className="text-[16px]">{q.stem}</CardTitle>
              <CardDescription>{q.type.replace("_", " ")} · {q.difficulty} · {q.explanation.slice(0, 120)}</CardDescription>
              {p.message && <div className="text-[13px] text-slate-500">Contributor note: “{p.message}”</div>}
            </CardHeader>
            <CardContent className="grid gap-2">
              <Textarea placeholder="Message to contributor (optional)…" value={msg[p.id] ?? ""} onChange={(e) => setMsg({ ...msg, [p.id]: e.target.value })} />
              <div className="flex flex-wrap gap-2">
                <Button variant="accent" onClick={() => decide(p.id, "commit")}>Commit + send message</Button>
                <Button variant="secondary" onClick={() => decide(p.id, "cancel")}>Cancel + send message</Button>
                <Button variant="ghost" onClick={() => { setMsg({ ...msg, [p.id]: "" }); decide(p.id, "cancel"); }}>Just cancel (default note)</Button>
              </div>
            </CardContent>
          </Card>
        );
      }) : <EmptyState title="Inbox zero" hint="Pending work lands here." />}
      <Card><CardHeader><CardTitle>Taxonomy queue</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {queue.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 px-3.5 py-2.5">
              <Badge tone="in_review">{t.kind}</Badge><span className="font-medium">{t.name}</span>
              <span className="ml-auto flex gap-2">
                <Button size="sm" onClick={() => decideTaxonomy(t.id, "approve")}>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => decideTaxonomy(t.id, "reject")}>Reject</Button>
              </span>
            </div>
          ))}
          {!queue.length && <div className="text-slate-500">Queue empty.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
