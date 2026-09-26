"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHero, EmptyState } from "@/components/page-hero";
import { Banner, BANNERS, BANNER_STYLES } from "@/components/activity-banner";
import { ContentExplorer, type PickedRef } from "@/components/content-explorer";
import { QuestionEditor, type QForm } from "@/components/question-editor";
import { toast } from "@/components/ui/toast";
import { ArrowUp, ArrowDown, X, Eye, FilePlus, ChevronDown, ChevronRight, LayoutList, Palette, ScrollText, Users, FolderPlus, Folder, Rocket, UserPlus, Trash2 } from "lucide-react";
import { fileIcon, typeLabel } from "@/components/drive-grid";
import { cn } from "@/lib/utils";

interface Q { id: string; stem: string; type: string; difficulty: string; }
interface AsmRef { kind: "q" | "f"; id: string; }
interface Meta { id: string; title: string; banner: string; details: string; rulesPractice: string; rulesTest: string; modes: string[]; visibility: string; category: string; sector: string; subject: string; role: string | null; }
interface ShareRow { id: string; userId: string; role: string; user: { name: string; email: string } | null; }

const MODES = [{ v: "practice", l: "Practice" }, { v: "selftest", l: "Self test" }, { v: "exam", l: "Test" }];
const CATS = [["primary", "Primary"], ["secondary", "Secondary"], ["tertiary", "Tertiary"], ["professional", "Professional"], ["other", "Other"]] as const;
const TABS = [
  { v: "content", l: "Content", icon: LayoutList },
  { v: "present", l: "Presentation", icon: Palette },
  { v: "rules", l: "Rules", icon: ScrollText },
  { v: "people", l: "People", icon: Users },
] as const;

export default function ActivityBuilder({ params }: { params: { id: string } }) {
  const [tab, setTab] = useState<string>("content");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [assembly, setAssembly] = useState<AsmRef[]>([]);
  const [cache, setCache] = useState<Record<string, Q>>({});
  const [folderNames, setFolderNames] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Record<string, Q[]>>({});
  const [openPreview, setOpenPreview] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showExplorer, setShowExplorer] = useState(false);
  const [showNewQ, setShowNewQ] = useState(false);
  const [topics, setTopics] = useState<{ id: string; name: string; subject: string; exam: string }[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [shares, setShares] = useState<ShareRow[]>([]);

  useEffect(() => {
    fetch(`/api/activities/${params.id}`).then(async (r) => {
      if (!r.ok) { toast("Activity not found."); window.location.href = "/play"; return; }
      const d = await r.json();
      if (d.meta.role !== "owner" && d.meta.role !== "editor") { toast("Not yours to build."); window.location.href = `/archive/${params.id}`; return; }
      setMeta(d.meta);
      const items = (d.items ?? []) as Q[];
      const qc: Record<string, Q> = {};
      for (const x of items) qc[x.id] = x;
      setCache(qc);
      const asm = d.assembly as { questionIds: string[]; folderIds: string[]; folderNames: Record<string, string>; order: AsmRef[] | null } | null;
      if (asm?.order?.length) setAssembly(asm.order);
      else setAssembly([...(asm?.questionIds ?? []).map((id) => ({ kind: "q" as const, id })), ...(asm?.folderIds ?? []).map((id) => ({ kind: "f" as const, id }))]);
      setFolderNames(asm?.folderNames ?? {});
    });
    fetch(`/api/activities/${params.id}/shares`).then((r) => (r.ok ? r.json() : [])).then(setShares);
    fetch("/api/topics").then((r) => (r.ok ? r.json() : [])).then((t) => setTopics(Array.isArray(t) ? t : [])).catch(() => {});
  }, [params.id]);

  // Guard against losing staged work.
  useEffect(() => {
    if (!dirty) return;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  function touchMeta(patch: Partial<Meta>) {
    if (!meta) return;
    setMeta({ ...meta, ...patch });
    setDirty(true);
  }

  function touchAssembly(next: AsmRef[]) {
    setAssembly(next);
    setDirty(true);
  }

  // Publish is the only go-live: one PATCH with everything staged.
  async function publish() {
    if (!meta || publishing) return;
    if (!meta.title.trim()) { toast("Give it a title first."); return; }
    if (!assembly.length) { toast("Link something first."); return; }
    setPublishing(true);
    const body: Record<string, unknown> = {
      title: meta.title, banner: meta.banner, details: meta.details,
      category: meta.category, sector: meta.sector, subject: meta.subject,
      modes: meta.modes, rulesPractice: meta.rulesPractice, rulesTest: meta.rulesTest,
      assembly,
    };
    if (meta.role === "owner") body.visibility = meta.visibility;
    const res = await fetch(`/api/activities/${params.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    setPublishing(false);
    if (!res.ok) { toast(d.error ?? "Publish failed"); return; }
    setDirty(false);
    toast("Published — live in archive and Play.");
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= assembly.length) return;
    const next = [...assembly];
    [next[i], next[j]] = [next[j], next[i]];
    touchAssembly(next);
  }

  function addPicked(items: PickedRef[]) {
    const have = new Set(assembly.map((r) => `${r.kind}:${r.id}`));
    const fresh = items.filter((p) => !have.has(`${p.kind}:${p.id}`));
    if (!fresh.length) { toast("Already linked."); return; }
    setCache((c) => {
      const next = { ...c };
      for (const p of fresh) {
        if (p.kind === "q") next[p.id] = { id: p.id, stem: p.stem ?? p.name, type: p.type ?? "mcq", difficulty: p.difficulty ?? "medium" };
      }
      return next;
    });
    setFolderNames((m) => {
      const next = { ...m };
      for (const p of fresh) if (p.kind === "f") next[p.id] = p.name;
      return next;
    });
    touchAssembly([...assembly, ...fresh.map((p) => ({ kind: p.kind, id: p.id }))]);
    toast(`Linked ${fresh.length}. Publish to go live.`);
  }

  // On-the-fly: file the question to your root, then link it here.
  async function createInline(f: QForm) {
    const res = await fetch("/api/drive/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, folderId: null }) });
    const d = await res.json();
    if (!res.ok) { toast(d.error); return; }
    setCache((c) => ({ ...c, [d.id]: { id: d.id, stem: d.stem, type: d.type, difficulty: d.difficulty } }));
    touchAssembly([...assembly, { kind: "q", id: d.id }]);
    setShowNewQ(false);
    toast("Created in your bank root and linked. Publish to go live.");
  }

  async function togglePreview(fid: string) {
    const open = !openPreview[fid];
    setOpenPreview((m) => ({ ...m, [fid]: open }));
    if (open && !preview[fid]) {
      const r = await fetch(`/api/drive/contents?folderId=${fid}`);
      const d = await r.json().catch(() => ({}));
      if (r.ok) setPreview((m) => ({ ...m, [fid]: (d.questions ?? []).slice(0, 6) }));
    }
  }

  async function invite() {
    if (!email.trim()) { toast("Enter their email."); return; }
    const res = await fetch(`/api/activities/${params.id}/shares`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role }) });
    if (!res.ok) { toast((await res.json()).error); return; }
    toast(`Added as ${role}.`);
    setEmail("");
    fetch(`/api/activities/${params.id}/shares`).then((r) => (r.ok ? r.json() : [])).then(setShares);
  }

  async function unshare(shareId: string) {
    const res = await fetch(`/api/activities/${params.id}/shares?shareId=${shareId}`, { method: "DELETE" });
    if (!res.ok) { toast((await res.json()).error); return; }
    toast("Removed.");
    fetch(`/api/activities/${params.id}/shares`).then((r) => (r.ok ? r.json() : [])).then(setShares);
  }

  async function removeActivity() {
    if (!confirm(`Delete “${meta?.title}”? Questions stay in the bank.`)) return;
    const res = await fetch(`/api/activities/${params.id}`, { method: "DELETE" });
    if (!res.ok) { toast((await res.json()).error); return; }
    window.location.href = "/play";
  }

  if (!meta) return <div className="py-10 text-center text-sm text-slate-500">Loading builder…</div>;
  const isOwner = meta.role === "owner";
  const linkedKeys = new Set(assembly.map((r) => `${r.kind}:${r.id}`));

  return (
    <div className="grid gap-4">
      <PageHero eyebrow="Activity builder" title={meta.title || "Untitled activity"} description={dirty ? "Unpublished changes — nothing is live until you publish." : "Everything here is live."}
        actions={<>
          <a href={`/archive/${meta.id}`}><Button variant="outline" className="border-white/20 text-white hover:bg-white/10 hover:text-white"><Eye className="h-4 w-4" /> Preview</Button></a>
          <Button variant="accent" onClick={publish} disabled={!dirty || publishing}><Rocket className="h-4 w-4" /> {publishing ? "Publishing…" : dirty ? "Publish" : "Published"}</Button>
        </>} tone="dark" />

      {/* steps: numbered, free to jump — Next/Next/Done without lock-in */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-soft">
        {TABS.map((t, i) => (
          <button key={t.v} onClick={() => setTab(t.v)}
            className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition", tab === t.v ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100")}>
            <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black", tab === t.v ? "bg-white/20" : "bg-slate-100 text-slate-500")}>{i + 1}</span>
            <t.icon className="h-4 w-4" />{t.l}
            {t.v === "content" && !!assembly.length && <span className={cn("rounded-full px-1.5 text-[11px] font-bold", tab === t.v ? "bg-white/20" : "bg-slate-100")}>{assembly.length}</span>}
          </button>
        ))}
      </div>

      {tab === "content" && (
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_300px]">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Assembly · {assembly.length}</CardTitle><CardDescription>Plays top-first; folders expand live in place.</CardDescription></CardHeader>
            <CardContent className="grid gap-2">
              {assembly.length ? assembly.map((ref, i) => (
                ref.kind === "q" ? (
                  <QRow key={`${ref.kind}:${ref.id}`} n={i + 1} q={cache[ref.id]} id={ref.id}
                    first={i === 0} last={i === assembly.length - 1}
                    onUp={() => move(i, -1)} onDown={() => move(i, 1)}
                    onRemove={() => touchAssembly(assembly.filter((_, j) => j !== i))} />
                ) : (
                  <FolderRow key={`${ref.kind}:${ref.id}`} n={i + 1} name={folderNames[ref.id] ?? "Folder"}
                    open={!!openPreview[ref.id]} items={preview[ref.id]}
                    first={i === 0} last={i === assembly.length - 1}
                    onToggle={() => togglePreview(ref.id)}
                    onUp={() => move(i, -1)} onDown={() => move(i, 1)}
                    onRemove={() => touchAssembly(assembly.filter((_, j) => j !== i))} />
                )
              )) : <EmptyState title="Empty activity" hint="Browse the bank or create a question to begin." />}
            </CardContent>
          </Card>
          <Card className="lg:sticky lg:top-20"><CardHeader className="pb-2"><CardTitle className="text-sm">Add content</CardTitle><CardDescription>Explorer, or make one.</CardDescription></CardHeader>
            <CardContent className="grid gap-2">
              <Button variant="accent" onClick={() => setShowExplorer(true)}><FolderPlus className="h-4 w-4" /> Browse bank</Button>
              <Button variant="outline" onClick={() => setShowNewQ(true)}><FilePlus className="h-4 w-4" /> New question</Button>
              <div className="text-xs leading-relaxed text-slate-400">Check files and folders across My bank, Shared, and Public tabs. New questions file to your root.</div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "present" && (
        <Card className="mx-auto w-full max-w-2xl"><CardHeader><CardTitle className="text-sm">Presentation</CardTitle><CardDescription>Staged — goes live on Publish.</CardDescription></CardHeader>
          <CardContent className="grid gap-3">
            <Banner preset={meta.banner} title={meta.title || "Untitled"} className="h-24 rounded-2xl" />
            <label className="yrk-label">Title<Input value={meta.title} onChange={(e) => touchMeta({ title: e.target.value })} /></label>
            <div className="grid gap-1.5">
              <span className="yrk-label">Banner</span>
              <div className="flex flex-wrap gap-1.5">
                {BANNERS.map((b) => (
                  <button key={b} title={b} onClick={() => touchMeta({ banner: b })}
                    className={cn("h-9 w-14 rounded-lg bg-gradient-to-br", BANNER_STYLES[b], meta.banner === b && "ring-2 ring-slate-900 ring-offset-2")} />
                ))}
              </div>
            </div>
            <label className="yrk-label">Details<Textarea value={meta.details} onChange={(e) => touchMeta({ details: e.target.value })} placeholder="What is this activity? Who is it for?" /></label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="yrk-label">Category
                <Select value={meta.category} onChange={(e) => touchMeta({ category: e.target.value })}>
                  {CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </label>
              <label className="yrk-label">Sector<Input value={meta.sector} onChange={(e) => touchMeta({ sector: e.target.value })} placeholder="e.g. Medicine" /></label>
              <label className="yrk-label">Subject<Input value={meta.subject} onChange={(e) => touchMeta({ subject: e.target.value })} placeholder="e.g. Anatomy" /></label>
            </div>
            <div className="grid gap-1.5">
              <span className="yrk-label">Modes</span>
              <div className="flex flex-wrap gap-1.5">
                {MODES.map((m) => {
                  const on = meta.modes.includes(m.v);
                  return <button key={m.v} onClick={() => {
                    const next = on ? meta.modes.filter((x) => x !== m.v) : [...meta.modes, m.v];
                    if (!next.length) { toast("Keep at least one mode."); return; }
                    touchMeta({ modes: next });
                  }} className={cn("rounded-lg border px-2.5 py-1.5 text-[13px] font-semibold transition", on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-500")}>{m.l}</button>;
                })}
              </div>
            </div>
            {isOwner && (
              <label className="yrk-label">Visibility
                <Select value={meta.visibility} onChange={(e) => touchMeta({ visibility: e.target.value })}>
                  <option value="private">Private — owner + added people</option>
                  <option value="public">Public — archive + every player</option>
                </Select>
              </label>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "rules" && (
        <Card className="mx-auto w-full max-w-2xl"><CardHeader><CardTitle className="text-sm">Rules candidates accept</CardTitle><CardDescription>Staged — goes live on Publish.</CardDescription></CardHeader>
          <CardContent className="grid gap-3">
            <label className="yrk-label">Practice / Self test rules<Textarea value={meta.rulesPractice} rows={4} onChange={(e) => touchMeta({ rulesPractice: e.target.value })} /></label>
            <label className="yrk-label">Test rules<Textarea value={meta.rulesTest} rows={4} onChange={(e) => touchMeta({ rulesTest: e.target.value })} /></label>
          </CardContent>
        </Card>
      )}

      {tab === "people" && (
        <Card className="mx-auto w-full max-w-2xl"><CardHeader><CardTitle className="text-sm">People</CardTitle><CardDescription>Viewers play · editors co-build. Invites apply immediately.</CardDescription></CardHeader>
          <CardContent className="grid gap-2">
            {isOwner && (
              <div className="flex gap-2">
                <Input className="flex-1" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Select className="w-auto" value={role} onChange={(e) => setRole(e.target.value)}><option value="viewer">Viewer</option><option value="editor">Editor</option></Select>
                <Button variant="accent" onClick={invite}><UserPlus className="h-4 w-4" /></Button>
              </div>
            )}
            {shares.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{s.user?.name ?? s.userId} <span className="text-xs text-slate-400">· {s.role}</span></span>
                {isOwner && <button className="rounded-md p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600" onClick={() => unshare(s.id)}><X className="h-4 w-4" /></button>}
              </div>
            ))}
            {!shares.length && <div className="text-[13px] text-slate-400">Only you so far.</div>}
            {isOwner && <button className="mt-1 flex w-fit items-center gap-1.5 text-[13px] text-red-600 hover:underline" onClick={removeActivity}><Trash2 className="h-3.5 w-3.5" /> Delete activity</button>}
          </CardContent>
        </Card>
      )}

      <StepNav tab={tab} setTab={setTab} dirty={dirty} publishing={publishing}
        onPublish={publish}
        onDone={() => { window.location.href = `/archive/${params.id}`; }} />

      {showExplorer && (
        <ContentExplorer open exclude={linkedKeys}          onAdd={(items) => {
            setCache((c) => {
              const next = { ...c };
              for (const p of items) {
                if (p.kind === "q") next[p.id] = { id: p.id, stem: p.stem ?? p.name, type: p.type ?? "mcq", difficulty: p.difficulty ?? "medium" };
              }
              return next;
            });
            setFolderNames((m) => {
              const next = { ...m };
              for (const p of items) if (p.kind === "f") next[p.id] = p.name;
              return next;
            });
            touchAssembly([...assembly, ...items.map((p) => ({ kind: p.kind, id: p.id }))]);
            setShowExplorer(false);
            toast(`Linked ${items.length}. Publish to go live.`);
          }}
          onClose={() => setShowExplorer(false)} />
      )}

      {showNewQ && (
        <div className="yrk-sheet fixed inset-0 z-40 overflow-y-auto bg-slate-900/50 p-3 sm:p-6" onClick={() => setShowNewQ(false)}>
          <div className="mx-auto max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between text-white">
              <span className="text-sm font-semibold">New question — files to your bank root and links here</span>
              <button onClick={() => setShowNewQ(false)} className="rounded-lg bg-white/10 p-1.5 hover:bg-white/20"><X className="h-4 w-4" /></button>
            </div>
            <QuestionEditor topics={topics} submitLabel="Create & link" onSubmit={createInline} />
          </div>
        </div>
      )}
    </div>
  );
}

function StepBtn({ disabled, title, onClick, children }: { disabled?: boolean; title: string; onClick: () => void; children: React.ReactNode }) {
  return <button className="rounded-md p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-30 sm:p-1.5" disabled={disabled} title={title} onClick={onClick}>{children}</button>;
}

const STEP_ORDER = ["content", "present", "rules", "people"];

// Procedural but free: Back/Next walk the steps, every step stays clickable,
// Publish stays hero-wide — nothing is ever locked.
function StepNav({ tab, setTab, dirty, publishing, onPublish, onDone }: {
  tab: string; setTab: (t: string) => void; dirty: boolean; publishing: boolean;
  onPublish: () => void; onDone: () => void;
}) {
  const i = Math.max(0, STEP_ORDER.indexOf(tab));
  const last = i === STEP_ORDER.length - 1;
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-soft">
      <Button variant="outline" size="sm" disabled={i === 0} onClick={() => setTab(STEP_ORDER[i - 1])}>Back</Button>
      <div className="flex flex-1 items-center justify-center gap-1.5">
        {STEP_ORDER.map((s, j) => (
          <button key={s} title={s} onClick={() => setTab(s)}
            className={cn("h-2 rounded-full transition", j === i ? "w-6 bg-slate-900" : j < i ? "w-2 bg-slate-400" : "w-2 bg-slate-200 hover:bg-slate-300")} />
        ))}
      </div>
      {last ? (
        dirty
          ? <Button variant="accent" size="sm" onClick={onPublish} disabled={publishing}><Rocket className="h-3.5 w-3.5" /> {publishing ? "Publishing…" : "Publish & finish"}</Button>
          : <Button variant="accent" size="sm" onClick={onDone}>Done</Button>
      ) : (
        <Button size="sm" onClick={() => setTab(STEP_ORDER[i + 1])}>Next</Button>
      )}
    </div>
  );
}

function QRow({ n, q, id, first, last, onUp, onDown, onRemove }: {
  n: number; q?: Q; id: string; first: boolean; last: boolean; onUp: () => void; onDown: () => void; onRemove: () => void;
}) {
  const Icon = q ? fileIcon(q.type) : FilePlus;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm">
      <span className="w-6 shrink-0 text-center font-bold tabular-nums text-slate-400">{n}</span>
      <Icon className="h-4 w-4 shrink-0 text-indigo-500" />
      <span className="min-w-0 flex-1 truncate">{q?.stem ?? id}</span>
      {q && <Badge>{typeLabel(q.type)}</Badge>}
      <StepBtn disabled={first} title="Move up" onClick={onUp}><ArrowUp className="h-3.5 w-3.5" /></StepBtn>
      <StepBtn disabled={last} title="Move down" onClick={onDown}><ArrowDown className="h-3.5 w-3.5" /></StepBtn>
      <button className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Remove" onClick={onRemove}><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function FolderRow({ n, name, open, items, first, last, onToggle, onUp, onDown, onRemove }: {
  n: number; name: string; open: boolean; items?: Q[]; first: boolean; last: boolean;
  onToggle: () => void; onUp: () => void; onDown: () => void; onRemove: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/40">
      <div className="flex items-center gap-2 px-3 py-2 text-sm">
        <span className="w-6 shrink-0 text-center font-bold tabular-nums text-slate-400">{n}</span>
        <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {open ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
          <Folder className="h-4 w-4 shrink-0 text-amber-500" fill="#fcd34d" />
          <span className="min-w-0 flex-1 truncate font-semibold">{name}</span>
          <Badge>folder · expands live</Badge>
        </button>
        <StepBtn disabled={first} title="Move up" onClick={onUp}><ArrowUp className="h-3.5 w-3.5" /></StepBtn>
        <StepBtn disabled={last} title="Move down" onClick={onDown}><ArrowDown className="h-3.5 w-3.5" /></StepBtn>
        <button className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Remove" onClick={onRemove}><X className="h-3.5 w-3.5" /></button>
      </div>
      {open && (
        <div className="grid gap-1 border-t border-amber-100 bg-white px-3 py-2">
          {(items ?? []).map((x) => {
            const Icon = fileIcon(x.type);
            return (
              <div key={x.id} className="flex items-center gap-2 text-[13px] text-slate-600">
                <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate">{x.stem}</span>
              </div>
            );
          })}
          {!(items ?? []).length && <div className="text-[13px] text-slate-400">Empty or unreachable folder.</div>}
        </div>
      )}
    </div>
  );
}
