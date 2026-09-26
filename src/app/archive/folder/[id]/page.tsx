"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DriveGrid } from "@/components/drive-grid";
import { QuestionView } from "@/components/question-view";
import { ArrowLeft, Folder, Lock } from "lucide-react";

interface Folder { id: string; name: string; }
interface File { id: string; stem: string; type: string; difficulty: string; }

export default function PublicFolderPage({ params }: { params: { id: string } }) {
  const [fid, setFid] = useState<string>(params.id);
  const [trail, setTrail] = useState<{ id: string | null; name: string }[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [ownerName, setOwnerName] = useState("");
  const [gone, setGone] = useState(false);
  const [viewQ, setViewQ] = useState<any>(null);
  const [me, setMe] = useState<{ id: string } | null>(null);

  function load(id: string) {
    fetch(`/api/drive/contents?folderId=${id}`).then(async (r) => {
      if (!r.ok) { setGone(true); return; }
      const d = await r.json();
      setFolders(d.folders ?? []);
      setFiles(d.questions ?? []);
      setTrail(d.breadcrumbs ?? []);
      setOwnerName(d.owner?.name ?? "");
    });
  }

  useEffect(() => { load(fid); }, [fid]);
  useEffect(() => { fetch("/api/auth/me").then((r) => r.json()).then((d) => setMe(d.user ?? null)).catch(() => {}); }, []);

  function openFile(id: string) {
    fetch(`/api/bank/${id}`).then((r) => r.json()).then((d) => setViewQ(d.question ?? null));
  }

  if (gone) return <div className="grid gap-3 py-10 text-center"><div className="flex items-center justify-center gap-2 font-bold"><Lock className="h-4 w-4" /> This folder isn't public.</div><a href="/archive" className="text-sm text-indigo-600 underline">Back to archive</a></div>;

  return (
    <div className="grid gap-4">
      <a href="/archive" className="w-fit"><Button variant="ghost" size="sm"><ArrowLeft className="h-3.5 w-3.5" /> Archive</Button></a>
      <Card><CardContent className="flex flex-wrap items-center gap-2 p-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50"><Folder className="h-4 w-4 text-emerald-600" fill="#6ee7b7" /></span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Public folder · by {ownerName}</div>
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            {trail.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-slate-300">›</span>}
                <button onClick={() => c.id && setFid(c.id)} className={i === trail.length - 1 ? "font-bold" : "text-indigo-600 hover:underline"}>{c.name}</button>
              </span>
            ))}
          </nav>
        </div>
        {!me && <Badge tone="draft">Log in to play these</Badge>}
      </CardContent></Card>
      <DriveGrid folders={folders} files={files} view="details" canManage={false} isOwn={false}
        onOpenFolder={(id) => setFid(id)} onOpenFile={openFile} onAction={() => {}} onMove={() => {}} />
      {viewQ && <QuestionView q={viewQ} canEdit={false} onEdit={() => {}} onClose={() => setViewQ(null)} />}
    </div>
  );
}
