"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHero, EmptyState } from "@/components/page-hero";
import { Bell } from "lucide-react";

interface N { id: string; kind: string; title: string; body: string; link: string; read: boolean; }

export default function NotificationsPage() {
  const [items, setItems] = useState<N[]>([]);
  function load() { fetch("/api/notifications").then((r) => (r.ok ? r.json() : [])).then(setItems); }
  useEffect(load, []);
  async function markAll() {
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    load();
  }
  async function open(n: N) {
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: n.id }) });
    window.location.href = n.link || "/bank";
  }
  return (
    <div className="grid gap-5">
      <PageHero eyebrow="Inbox" title="Notifications" description="Decisions and review requests."
        actions={<Button variant="secondary" onClick={markAll}><Bell className="h-4 w-4" /> Mark all read</Button>} />
      <Card><CardHeader><CardTitle>Recent</CardTitle><CardDescription>Newest first.</CardDescription></CardHeader>
        <CardContent className="grid gap-2">
          {items.map((n) => (
            <button key={n.id} onClick={() => open(n)} className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-100 px-4 py-3 text-left transition hover:shadow-soft">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-slate-200" : "bg-indigo-600"}`} />
              <span className="min-w-0"><span className="flex flex-wrap items-center gap-2 text-sm font-semibold">{n.title} <Badge tone={n.kind === "decision" ? "approved" : "in_review"}>{n.kind}</Badge></span>
              <span className="block break-words text-[13px] text-slate-500">{n.body}</span></span>
            </button>
          ))}
          {!items.length && <EmptyState title="All quiet" hint="Decisions land here." />}
        </CardContent>
      </Card>
    </div>
  );
}
