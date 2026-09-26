"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { PageHero, EmptyState } from "@/components/page-hero";
import { toast } from "@/components/ui/toast";

interface App { id: string; message: string; status: string; applicant: { name: string; email: string } | null; }

export default function BankDetail({ params }: { params: { id: string } }) {
  const [data, setData] = useState<{ question: { id: string; stem: string; options: string; correct: string; explanation: string; difficulty: string; type: string; creatorId?: string; allowApplications?: boolean }; creator: { name: string; email: string } | null; editors: { name: string }[] } | null>(null);
  const [apps, setApps] = useState<App[]>([]);
  const [me, setMe] = useState<{ id: string } | null>(null);
  const [applyMsg, setApplyMsg] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    fetch(`/api/bank/${params.id}`).then((r) => r.json()).then(setData);
    fetch(`/api/questions/${params.id}/applications`).then((r) => (r.ok ? r.json() : [])).then(setApps);
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setMe(d.user)).catch(() => {});
  }
  useEffect(load, [params.id]);

  async function toggle() {
    setBusy(true);
    const res = await fetch(`/api/bank/${params.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ allowApplications: !data?.question.allowApplications }) });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) toast(d.error);
    else { toast(d.allowApplications ? "Made appliable, others can now apply to edit." : "Closed, no new applications."); load(); }
  }

  async function apply() {
    if (!applyMsg.trim()) { toast("Tell the creator why you’d be a good editor."); return; }
    const res = await fetch(`/api/questions/${params.id}/applications`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: applyMsg }) });
    const d = await res.json();
    if (!res.ok) toast(d.error);
    else { toast("Application sent, the creator will approve or decline."); setApplyMsg(""); load(); }
  }

  async function decide(id: string, decision: string) {
    const res = await fetch(`/api/applications/${id}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) });
    const d = await res.json();
    if (!res.ok) toast(d.error);
    else { toast(decision === "approved" ? "Approved, editor added to this question." : "Declined gracefully."); load(); }
  }

  if (!data) return <div className="text-sm text-slate-500 dark:text-[#9aa3b2]">Loading question…</div>;
  const q = data.question;
  const isCreator = me && q.creatorId === me.id;
  const opts = JSON.parse(q.options || "[]") as string[];
  const correct = JSON.parse(q.correct || "[]") as string[];

  return (
    <div className="grid gap-5">
      <PageHero eyebrow={q.allowApplications ? "Open for editors" : "Bank question"} title={q.stem}
        description={`${(q.type ?? "").replace("_", " ")} · ${q.difficulty} · by ${data.creator?.name ?? "unclaimed"}${data.editors.length ? ` · editors: ${data.editors.map((e) => e.name).join(", ")}` : ""}`} />
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-4">
          <Card><CardHeader><CardTitle>Answer & guide</CardTitle><CardDescription>{opts.length ? `Options: ${opts.join(" · ")}` : "Theory question, written answer"}</CardDescription></CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <div><Badge tone="approved">Answer: {correct.join(", ") || "see guide"}</Badge></div>
              <p className="leading-relaxed text-slate-600 dark:text-[var(--yrk-text-secondary)]">{q.explanation}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {(isCreator || !q.creatorId) && <Button onClick={toggle} disabled={busy}>{q.allowApplications ? "Close applications" : "Make appliable"}</Button>}
                <a href="/bank"><Button variant="secondary">Back to bank</Button></a>
              </div>
            </CardContent>
          </Card>
          {!isCreator && q.allowApplications && (
            <Card><CardHeader><CardTitle>Apply to edit</CardTitle></CardHeader>
              <CardContent className="grid gap-3">
                <Textarea placeholder="What would you improve?" value={applyMsg} onChange={(e) => setApplyMsg(e.target.value)} />
                <Button onClick={apply}>Send application</Button>
              </CardContent>
            </Card>
          )}
          {!isCreator && !q.allowApplications && (
            <Card><CardContent className="flex flex-wrap items-center gap-3 p-5 text-sm text-slate-500 dark:text-[#9aa3b2]">Not open for editing.<a href="/bank"><Button variant="secondary" size="sm">Find open questions</Button></a></CardContent></Card>
          )}
        </div>
        <Card><CardHeader><CardTitle>Applications {isCreator ? "· inbox" : "· mine"}</CardTitle><CardDescription>{isCreator ? "Approve editors you trust." : "Only you can see your own."}</CardDescription></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {apps.map((a) => (
              <div key={a.id} className="rounded-xl border border-slate-100 dark:border-[var(--yrk-border-subtle)] p-3">
                <div className="flex items-center justify-between gap-2"><span className="font-semibold">{a.applicant?.name}</span><Badge tone={a.status === "pending" ? "in_review" : a.status === "approved" ? "approved" : "closed"}>{a.status}</Badge></div>
                <div className="mt-1 text-slate-500 dark:text-[#9aa3b2]">“{a.message}”</div>
                {isCreator && a.status === "pending" && (
                  <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => decide(a.id, "approved")}>Approve</Button><Button size="sm" variant="outline" onClick={() => decide(a.id, "rejected")}>Decline</Button></div>
                )}
              </div>
            ))}
            {!apps.length && <EmptyState title="No applications" hint="None yet." />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
