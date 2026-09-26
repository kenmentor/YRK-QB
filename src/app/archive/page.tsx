"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHero, EmptyState } from "@/components/page-hero";
import { Banner } from "@/components/activity-banner";
import { NewActivityButton } from "@/components/new-activity-button";
import { useSession } from "@/lib/use-session";
import { Search, Folder, ArrowRight, Globe } from "lucide-react";

interface Activity { id: string; title: string; banner: string; details: string; modes: string[]; ownerName: string; contributors: { id: string; name: string }[]; questionCount: number; category: string; sector: string; }
interface PubFolder { id: string; name: string; ownerId: string; ownerName: string; publicAccess: string; questionCount: number; category: string; sector: string; }

const LADDER = ["primary", "secondary", "tertiary", "professional", "other"];
const LADDER_LABEL: Record<string, string> = {
  primary: "Primary", secondary: "Secondary", tertiary: "Tertiary",
  professional: "Professional", other: "Other",
};

export default function ArchivePage() {
  const [acts, setActs] = useState<Activity[]>([]);
  const [folders, setFolders] = useState<PubFolder[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("");
  const { user: me, loaded: authLoaded } = useSession();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/archive").then((r) => r.json()).then((d) => { setActs(d.activities ?? []); setFolders(d.folders ?? []); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const matchQ = (s: string) => !q || s.toLowerCase().includes(q.toLowerCase());
  const fActs = acts.filter((a) => (!cat || (a.category ?? "tertiary") === cat) && matchQ(a.title + " " + a.details + " " + a.ownerName));
  const fFolders = folders.filter((f) => (!cat || (f.category ?? "tertiary") === cat) && matchQ(f.name + " " + f.ownerName));
  const actGroups = LADDER.map((c) => ({ cat: c, items: fActs.filter((a) => (a.category ?? "tertiary") === c) })).filter((g) => g.items.length);

  return (
    <div className="grid gap-6">
      <PageHero eyebrow="Public archive" title="Artifacts & public folders"
        description={me ? "Published by the community. Open one for its rules, then play — or start your own." : "Published by the community. Log in to play and track history."}
        actions={!authLoaded ? undefined : me ? <NewActivityButton /> : <a href="/login"><Button variant="accent">Log in to play</Button></a>} tone="dark" />
      <Card><CardContent className="grid gap-3 p-4">
        <div className="relative"><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          <Input className="pl-10" placeholder="Search artifacts and folders…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setCat("")} className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${!cat ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:text-slate-800"}`}>All</button>
          {LADDER.map((c) => (
            <button key={c} onClick={() => setCat(cat === c ? "" : c)} className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${cat === c ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:text-slate-800"}`}>{LADDER_LABEL[c]}</button>
          ))}
        </div>
      </CardContent></Card>

      <section className="grid gap-5">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-slate-400"><Globe className="h-4 w-4" /> Activities · {loading ? "…" : fActs.length}</h2>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white">
                <div className="h-28 animate-pulse bg-slate-100" />
                <div className="grid gap-2 p-5">
                  <div className="h-5 w-3/4 animate-pulse rounded-md bg-slate-100" />
                  <div className="h-4 w-1/2 animate-pulse rounded-md bg-slate-100" />
                  <div className="h-4 w-full animate-pulse rounded-md bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : actGroups.length ? actGroups.map((g) => (
          <div key={g.cat} className="grid gap-3">
            <h3 className="flex items-center gap-2 text-[13px] font-bold text-slate-600">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-900 text-[10px] font-black text-white">{LADDER.indexOf(g.cat) + 1}</span>
              {LADDER_LABEL[g.cat]}
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {g.items.map((a) => (
                <Card key={a.id} className="overflow-hidden transition hover:shadow-lift">
                  <Banner preset={a.banner} title={a.title} />
                  <CardContent className="grid gap-2 p-5">
                    <div className="text-lg font-bold leading-snug">{a.title}</div>
                    <div className="text-[13px] text-slate-500">
                      by <span className="font-semibold text-slate-700">{a.ownerName}</span>
                      {!!a.contributors.length && <> · with {a.contributors.map((c) => c.name).join(", ")}</>}
                    </div>
                    {a.details && <div className="line-clamp-2 text-sm text-slate-500">{a.details}</div>}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge>{a.questionCount} Qs</Badge>
                      <Badge tone="draft">{LADDER_LABEL[a.category ?? "tertiary"] ?? a.category}{a.sector ? ` · ${a.sector}` : ""}</Badge>
                      {a.modes.map((m) => <Badge key={m} tone="draft">{m === "exam" ? "Test" : m === "selftest" ? "Self test" : "Practice"}</Badge>)}
                      <a href={`/archive/${a.id}`} className="ml-auto"><Button size="sm" variant="secondary">Open <ArrowRight className="h-3.5 w-3.5" /></Button></a>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )) : <EmptyState title="No public activities yet" hint="Publish one from your builder and it lands here." />}
      </section>

      <section className="grid gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-slate-400"><Folder className="h-4 w-4" /> Public folders · {loading ? "…" : fFolders.length}</h2>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4">
                <span className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-slate-100" />
                <div className="grid flex-1 gap-1.5"><span className="h-4 w-2/3 animate-pulse rounded-md bg-slate-100" /><span className="h-3 w-1/2 animate-pulse rounded-md bg-slate-100" /></div>
              </div>
            ))}
          </div>
        ) : fFolders.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fFolders.map((f) => (
              <a key={f.id} href={`/archive/folder/${f.id}`} className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft transition hover:shadow-lift">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50"><Folder className="h-5 w-5 text-amber-500" fill="#fcd34d" strokeWidth={1.5} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-semibold"><span className="truncate">{f.name}</span><Globe className="h-3.5 w-3.5 shrink-0 text-slate-400" /></div>
                  <div className="truncate text-xs text-slate-400">by {f.ownerName} · {f.questionCount} Qs · {LADDER_LABEL[f.category ?? "tertiary"] ?? f.category}{f.sector ? ` · ${f.sector}` : ""} · {f.publicAccess === "use" ? "playable" : "view only"}</div>
                </div>
              </a>
            ))}
          </div>
        ) : <EmptyState title="No public folders yet" hint="Owners publish folders from Share." />}
      </section>
    </div>
  );
}
