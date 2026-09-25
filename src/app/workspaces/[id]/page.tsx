"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { QuestionEditor, type QForm } from "@/components/question-editor";

interface Draft { id: string; stem: string; status: string; type: string; options: string; correct: string; explanation: string; difficulty: string; authorId: string; topicId?: string; conflictBranch?: boolean; }
interface Ws {
  id: string; name: string; focus: string; subjectId?: string;
  destination?: { topic?: string; subject?: string; course?: string; session?: string };
  drafts: Draft[]; memberships: { userId: string; role: string; user: { email: string; name: string } | null }[];
}
interface Progress { subjects: { id: string; name: string; topics: { id: string; name: string; draft: number; inReview: number; approved: number; published: number }[] }[]; note?: string; }
interface BankQ { id: string; stem: string; type: string; difficulty: string; topicName: string; }
interface JoinReq { id: string; role: string; message: string; status: string; user: { name: string; email: string } | null; }

export default function WorkspaceDetail({ params }: { params: { id: string } }) {
  const [ws, setWs] = useState<Ws | null>(null);
  const [me, setMe] = useState<{ id: string } | null>(null);
  const [tab, setTab] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<Record<string, { versions: { id: string; note: string; stem: string }[]; comments: { id: string; body: string }[]; reviews: { id: string; verdict: string; comment: string }[] }>>({});
  const [topics, setTopics] = useState<{ id: string; name: string; subject: string; exam: string }[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [bankQs, setBankQs] = useState<BankQ[]>([]);
  const [joins, setJoins] = useState<JoinReq[]>([]);
  const [showBank, setShowBank] = useState(false);
  const [inviteQ, setInviteQ] = useState("");
  const [suggest, setSuggest] = useState<{ id: string; name: string; email: string; role: string }[]>([]);
  const [inviteRole, setInviteRole] = useState("editor");

  function load() {
    fetch(`/api/workspaces/${params.id}`).then((r) => r.json()).then(setWs);
    fetch(`/api/workspaces/${params.id}/progress`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setProgress(d));
    fetch(`/api/workspaces/${params.id}/published`).then((r) => (r.ok ? r.json() : [])).then(setBankQs);
    fetch(`/api/workspaces/${params.id}/join`).then((r) => (r.ok ? r.json() : [])).then((d) => Array.isArray(d) && setJoins(d.filter((j: JoinReq) => j.status === "pending")));
  }
  useEffect(load, [params.id]);
  useEffect(() => { fetch("/api/auth/me").then((r) => r.json()).then((d) => setMe(d.user)); }, []);
  useEffect(() => { fetch("/api/topics").then((r) => (r.ok ? r.json() : [])).then(setTopics); }, []);
  useEffect(() => {
    if (inviteQ.length < 1) { setSuggest([]); return; }
    const t = setTimeout(() => fetch(`/api/users/search?q=${encodeURIComponent(inviteQ)}`).then((r) => (r.ok ? r.json() : [])).then(setSuggest), 200);
    return () => clearTimeout(t);
  }, [inviteQ]);

  const myRole = ws?.memberships.find((m) => m.userId === me?.id)?.role;
  const canEdit = myRole === "owner" || myRole === "editor";
  const canInvite = myRole === "owner";
  const canReview = myRole === "owner" || myRole === "reviewer";
  const canMerge = myRole === "owner";

  async function loadDetail(id: string) {
    const r = await fetch(`/api/drafts/${id}`);
    if (r.ok) { const data = await r.json(); setDetail((d) => ({ ...d, [id]: data })); }
  }

  async function addDraft(f: QForm) {
    const res = await fetch("/api/drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId: params.id, type: f.type, stem: f.stem, options: f.options, correct: f.correct, explanation: f.explanation, difficulty: f.difficulty, topicId: f.topicId || undefined }) });
    if (!res.ok) { const d = await res.json(); toast(`Could not save: ${d.error}`); return; }
    const tName = topics.find((t) => t.id === f.topicId)?.name;
    toast(tName ? `Draft saved under ${tName}, send for review when ready.` : "Draft saved, send for review when ready. The bank owner publishes after approval.");
    load();
  }

  async function saveEdit(d: Draft, f: QForm) {
    // Send the latest version we know so concurrent edits flag a conflict branch.
    let baseVersionId: string | undefined;
    if (detail[d.id]?.versions?.length) baseVersionId = detail[d.id].versions[0].id;
    else {
      const r = await fetch(`/api/drafts/${d.id}`);
      if (r.ok) { const full = await r.json(); baseVersionId = full.versions?.[0]?.id; }
    }
    const res = await fetch(`/api/drafts/${d.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stem: f.stem, options: f.options, correct: f.correct, explanation: f.explanation, difficulty: f.difficulty, topicId: f.topicId || undefined, note: "edit", baseVersionId }) });
    const data = await res.json();
    if (!res.ok) toast(`Cannot edit: ${data.error}`);
    else { toast(data.conflict ? "Saved with conflict, reviewer will resolve in versions." : "Edit saved as new version."); load(); loadDetail(d.id); }
  }

  async function review(id: string, action: string, verdict?: string) {
    const comment = prompt(action === "request" ? "Note for reviewer?" : "Review comment?") ?? "";
    const res = await fetch(`/api/drafts/${id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, verdict, comment }) });
    const data = await res.json();
    if (!res.ok) toast(`Review blocked: ${data.error}`);
    else if (action === "request") toast("Draft sent, will be reviewed and published by the bank owner.");
    else if (verdict === "approved") toast("Approved, ready to merge to the bank.");
    else toast("Changes requested, back to draft for edits.");
    load(); loadDetail(id);
  }

  async function addComment(id: string) {
    const body = prompt("Comment?") ?? "";
    if (!body) return;
    await fetch(`/api/drafts/${id}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
    toast("Comment posted to the team.");
    loadDetail(id);
  }

  async function mergeOne(id: string) {
    const res = await fetch("/api/merges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "approve_to_live", draftIds: [id] }) });
    const data = await res.json();
    toast(res.ok ? (data.duplicateWarning ? `Published, possible duplicate: ${data.duplicateWarning}` : "Published to the bank.") : `Merge blocked: ${data.error}`);
    load();
  }

  async function publishSet() {
    const ids = (ws?.drafts ?? []).map((d) => d.id);
    const res = await fetch("/api/merges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "set_publish", draftIds: ids }) });
    const data = await res.json();
    toast(res.ok ? `Set published: ${data.published.length} live, ${data.skipped.length} skipped (not approved).` : `Publish blocked: ${data.error}`);
    load();
  }

  async function invite(email: string) {
    const res = await fetch(`/api/workspaces/${params.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role: inviteRole }) });
    const data = await res.json();
    toast(res.ok ? `Invited ${email} as ${inviteRole}.` : `Invite blocked: ${data.error}`);
    if (res.ok) { setInviteQ(""); setSuggest([]); load(); }
  }

  async function removeMember(userId: string, name: string) {
    if (!confirm(`Remove ${name} from this workspace?`)) return;
    const res = await fetch(`/api/workspaces/${params.id}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove", userId }) });
    const data = await res.json();
    toast(res.ok ? `Removed ${name}.` : data.error);
    if (res.ok) load();
  }

  async function leave() {
    if (!confirm("Leave this workspace?")) return;
    const res = await fetch(`/api/workspaces/${params.id}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "leave" }) });
    const data = await res.json();
    if (!res.ok) toast(data.error);
    else { toast("Left the workspace."); window.location.href = "/workspaces"; }
  }

  async function deleteWorkspace() {
    if (!confirm(`Delete "${ws?.name}" and all its drafts? Published bank questions stay.`)) return;
    if (!confirm("Really delete? This can't be undone.")) return;
    const res = await fetch(`/api/workspaces/${params.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) });
    const data = await res.json();
    if (!res.ok) toast(data.error);
    else { toast("Workspace deleted."); window.location.href = "/workspaces"; }
  }

  async function deleteDraft(id: string) {
    if (!confirm("Delete this draft and its history?")) return;
    const res = await fetch(`/api/drafts/${id}`, { method: "DELETE" });
    const data = await res.json();
    toast(res.ok ? "Draft deleted." : data.error);
    if (res.ok) load();
  }

  // Revise a published bank question: opens a linked draft; merging it
  // updates the canonical instead of duplicating.
  async function revise(q: BankQ) {
    const full = await fetch(`/api/bank/${q.id}`).then((r) => r.json());
    const question = full.question;
    const res = await fetch("/api/drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      workspaceId: params.id, type: question.type, stem: question.stem,
      options: JSON.parse(question.options || "[]"), correct: JSON.parse(question.correct || "[]"),
      explanation: question.explanation, difficulty: question.difficulty, topicId: question.topicId ?? undefined,
      revisionOf: q.id
    }) });
    const data = await res.json();
    toast(res.ok ? "Revision draft opened, edit it below, then review and merge." : `Cannot revise: ${data.error}`);
    if (res.ok) { setShowBank(false); load(); }
  }

  async function decideJoin(id: string, decision: "approve" | "decline") {
    const message = decision === "decline" ? (prompt("Message to applicant? (optional)") ?? "") : "";
    const res = await fetch(`/api/join-requests/${id}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, message }) });
    const data = await res.json();
    toast(res.ok ? (decision === "approve" ? "Member added." : "Request declined.") : data.error);
    if (res.ok) load();
  }

  if (!ws) return <div className="text-sm text-slate-500">Loading space…</div>;
  return (
    <div className="grid gap-5">
      <div className="overflow-hidden rounded-3xl bg-slate-900 p-6 text-white shadow-lift sm:p-8">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-300">Workspace · your role: {myRole ?? "none"}</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{ws.name}</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-300">{ws.focus}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {(ws.memberships ?? []).map((m, i) => (
            <span key={i} className="flex items-center gap-1.5 rounded-full bg-white/10 py-1 pl-2.5 pr-1.5 text-[11px] font-semibold text-slate-100">
              {m.user?.name ?? m.userId} · {m.role}
              {canInvite && m.userId !== me?.id && (
                <button title={`Remove ${m.user?.name}`} onClick={() => removeMember(m.userId, m.user?.name ?? m.userId)} className="rounded-full px-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white">×</button>
              )}
            </span>
          ))}
        </div>
        {canInvite ? (
          <div className="relative mt-5">
            <div className="flex flex-col gap-2 min-[420px]:flex-row">
              <Input className="border-white/10 bg-white text-slate-900" placeholder="Invite by name or email…" value={inviteQ} onChange={(e) => setInviteQ(e.target.value)} />
              <select className="yrk-select w-auto" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                <option value="editor">Editor</option><option value="reviewer">Reviewer (professor)</option><option value="owner">Owner</option>
              </select>
            </div>
            {!!suggest.length && (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-lift">
                {suggest.map((u) => (
                  <button key={u.id} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition hover:bg-slate-50" onClick={() => invite(u.email)}>
                    <span className="font-medium">{u.name} <span className="font-normal text-slate-400">· {u.email}</span></span><span className="text-xs text-slate-400">{u.role}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : <div className="mt-4 text-xs text-slate-400">Only the owner can invite, ask the owner to add members.</div>}
        {canMerge && <div className="mt-4 flex flex-wrap gap-2"><Button variant="accent" onClick={publishSet}>Publish approved set</Button><Button variant="outline" className="border-white/20 text-white hover:bg-white/10 hover:text-white" onClick={deleteWorkspace}>Delete workspace</Button></div>}
        {myRole && !canMerge && <div className="mt-4"><Button variant="ghost" size="sm" className="text-slate-400 hover:text-white" onClick={leave}>Leave workspace</Button></div>}
      </div>

      {/* Where this workspace lands in the bank: session > course > subject > topic */}
      <Card><CardHeader><CardTitle>Builds into the bank</CardTitle>
        <CardDescription>
          {[ws.destination?.session, ws.destination?.course, ws.destination?.subject, ws.destination?.topic].filter(Boolean).join("  ›  ") || "No destination yet, attach one so output lands in the right segment."}
        </CardDescription></CardHeader>
        <CardContent className="grid gap-2">
          {(!progress || !progress.subjects.length) && <div className="text-sm text-slate-500">{progress?.note ?? "Loading build…"}</div>}
          {(progress?.subjects ?? []).map((s) => (
            <div key={s.id} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-center justify-between text-sm"><span className="font-semibold">{s.name}</span>
                <span className="flex items-center gap-2"><span className="text-xs text-slate-400">{s.topics.reduce((n, t) => n + t.published, 0)} in bank</span>
                <a href={`/bank/subject/${s.id}`}><Button variant="ghost" size="sm">View subject</Button></a></span></div>
              {s.topics.map((t) => {
                const total = t.draft + t.inReview + t.approved + t.published;
                const pct = total ? Math.round((t.published / total) * 100) : 0;
                return (
                  <div key={t.id} className="mt-2 text-[13px]">
                    <div className="flex justify-between"><span>{t.name}</span><span className="text-slate-400">{t.published} bank · {t.inReview} review · {t.approved} ready · {t.draft} draft</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* What this workspace put in the bank, revisable from here */}
      <Card><CardHeader>
        <div className="flex items-center justify-between"><CardTitle>In the bank ({bankQs.length})</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setShowBank((v) => !v)}>{showBank ? "Hide" : "Show"}</Button></div>
        <CardDescription>Published from here. Revise opens a linked draft, merging updates the original.</CardDescription></CardHeader>
        {showBank && <CardContent className="grid gap-2 text-sm">
          {bankQs.map((q) => (
            <div key={q.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 px-3.5 py-2.5">
              <span className="min-w-0 flex-1 break-words">{q.stem}</span>
              <Badge tone={q.difficulty}>{q.difficulty}</Badge>
              {canEdit && <Button size="sm" variant="outline" onClick={() => revise(q)}>Revise</Button>}
            </div>
          ))}
          {!bankQs.length && <div className="text-slate-500">Nothing published yet, approve and merge drafts above.</div>}
        </CardContent>}
      </Card>

      {/* Join requests for owners */}
      {canInvite && !!joins.length && (
        <Card><CardHeader><CardTitle>Join requests ({joins.length})</CardTitle><CardDescription>People asking to become editor or reviewer.</CardDescription></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {joins.map((j) => (
              <div key={j.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 px-3.5 py-2.5">
                <span className="font-medium">{j.user?.name}</span><Badge>{j.role}</Badge>
                <span className="text-slate-500">“{j.message}”</span>
                <span className="ml-auto flex gap-2">
                  <Button size="sm" onClick={() => decideJoin(j.id, "approve")}>Add</Button>
                  <Button size="sm" variant="outline" onClick={() => decideJoin(j.id, "decline")}>Decline</Button>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {canEdit ? (
        <QuestionEditor key={ws.drafts.length} topics={topics} submitLabel="Save draft" onSubmit={addDraft} />
      ) : <div className="rounded-2xl border border-slate-200/80 bg-white p-5 text-sm text-slate-500 shadow-soft">Reviewers comment and approve below, editing is for editors.</div>}

      {(ws.drafts ?? []).map((d) => (
        <Card key={d.id} className={d.conflictBranch ? "border-amber-400" : ""}>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="yrk-wrap min-w-0 flex-1 text-sm font-medium">{d.stem || "(empty)"} {d.conflictBranch && <span className="text-amber-600">· conflict</span>}</div>
              <Badge status={d.status} className="shrink-0">{d.status}</Badge>
            </div>
            <div className="mt-1 text-xs text-slate-500">{d.type} · {d.difficulty}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["edit", "versions", "comments", "review"] as const).map((t) => {
                if (t === "edit" && !canEdit) return null;
                if (t === "review" && !canReview) return null;
                return <Button key={t} variant={tab[d.id] === t ? "default" : "outline"} onClick={() => { setTab((x) => ({ ...x, [d.id]: t })); loadDetail(d.id); }}>{t}</Button>;
              })}
              {canEdit && <Button variant="secondary" onClick={() => review(d.id, "request")}>Send for review</Button>}
              {canMerge && <Button onClick={() => mergeOne(d.id)}>Merge → bank</Button>}
              {(canMerge || (me && d.authorId === me.id)) && <Button variant="ghost" size="sm" className="text-slate-400" onClick={() => deleteDraft(d.id)}>Delete</Button>}
            </div>
            {tab[d.id] === "edit" && canEdit && (
              <div className="mt-3">
                <QuestionEditor key={d.id} topics={topics} submitLabel="Save as new version"
                  initial={{ type: d.type as QForm["type"], stem: d.stem, options: JSON.parse(d.options || "[]"), correct: JSON.parse(d.correct || "[]"), explanation: d.explanation, difficulty: d.difficulty, topicId: d.topicId ?? "" }}
                  onSubmit={(f) => saveEdit(d, f)} />
              </div>
            )}
            {tab[d.id] === "versions" && <div className="mt-3 text-xs">{(detail[d.id]?.versions ?? []).map((v) => <div key={v.id} className="border-b py-1">{v.note} · {v.stem?.slice(0, 80)}</div>)}{!(detail[d.id]?.versions?.length) && "No versions yet."}</div>}
            {tab[d.id] === "comments" && (
              <div className="mt-3 text-xs">
                {(detail[d.id]?.comments ?? []).map((c) => <div key={c.id} className="border-b py-1">{c.body}</div>)}
                <Button variant="outline" onClick={() => addComment(d.id)}>Add comment</Button>
              </div>
            )}
            {tab[d.id] === "review" && canReview && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => review(d.id, "review", "approved")}>Approve · “This is good”</Button>
                <Button variant="outline" onClick={() => review(d.id, "review", "changes_requested")}>Request changes</Button>
                <div className="text-xs text-slate-500">{(detail[d.id]?.reviews ?? []).map((r) => `${r.verdict}: ${r.comment}`).join(" · ")}</div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
