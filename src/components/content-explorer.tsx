import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Folder, ChevronRight, Search, X, Check } from "lucide-react";
import { fileIcon, typeLabel } from "./drive-grid";
import { cn } from "@/lib/utils";

export interface PickedRef {
  kind: "q" | "f";
  id: string;
  name: string;
  sub: string;
  type?: string;
  stem?: string;
  difficulty?: string;
}

interface RowFolder { id: string; name: string; ownerName?: string; }
interface RowFile { id: string; stem: string; type: string; difficulty: string; }
interface Crumb { id: string | null; name: string; ownerId?: string | null; }

type Tab = "mine" | "shared" | "public";

// Checkbox file explorer for linking content: My bank, Shared with me,
// and usable Public folders. Selections append as ordered mixed refs.
export function ContentExplorer({ open, exclude, onAdd, onClose }: {
  open: boolean;
  exclude: Set<string>; // "q:<id>" / "f:<id>" already linked
  onAdd: (items: PickedRef[]) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("mine");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [folders, setFolders] = useState<RowFolder[]>([]);
  const [files, setFiles] = useState<RowFile[]>([]);
  const [roots, setRoots] = useState<{ id: string | null; name: string; ownerId: string; ownerName: string; role: string }[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<PickedRef[]>([]);

  function reset(tabNext: Tab) {
    setTab(tabNext);
    setFolderId(null);
    setOwnerId(null);
    setQ("");
  }

  useEffect(() => {
    if (!open) return;
    if (tab === "shared" && !folderId && !ownerId) {
      fetch("/api/drive/shares/mine").then((r) => (r.ok ? r.json() : [])).then((d: { folderId: string | null; folderName: string | null; ownerId: string; ownerName: string; role: string }[]) => {
        setRoots((Array.isArray(d) ? d : []).map((s) => ({ id: s.folderId, name: s.folderName ?? `${s.ownerName}'s bank`, ownerId: s.ownerId, ownerName: s.ownerName, role: s.role })));
      });
      setFolders([]); setFiles([]); setCrumbs([]);
      return;
    }
    if (tab === "public" && !folderId) {
      fetch("/api/archive").then((r) => (r.ok ? r.json() : { folders: [] })).then((d: { folders: { id: string; name: string; ownerName: string; publicAccess: string }[] }) => {
        const use = (d.folders ?? []).filter((f) => f.publicAccess === "use");
        setRoots(use.map((f) => ({ id: f.id, name: f.name, ownerId: "", ownerName: f.ownerName, role: "public-use" })));
      });
      setFolders([]); setFiles([]); setCrumbs([]);
      return;
    }
    const params = new URLSearchParams();
    if (folderId) params.set("folderId", folderId);
    if (ownerId) params.set("ownerId", ownerId);
    fetch(`/api/drive/contents${params.toString() ? `?${params.toString()}` : ""}`).then(async (r) => {
      if (!r.ok) { setFolders([]); setFiles([]); return; }
      const d = await r.json();
      setFolders(d.folders ?? []);
      setFiles(d.questions ?? []);
      setCrumbs(d.breadcrumbs ?? []);
      setRoots([]);
    });
  }, [open, tab, folderId, ownerId]);

  if (!open) return null;

  const atRoot = !folderId && !ownerId;
  const selKeys = new Set(selected.map((s) => `${s.kind}:${s.id}`));

  function toggle(p: PickedRef) {
    const key = `${p.kind}:${p.id}`;
    setSelected((s) => (s.some((x) => `${x.kind}:${x.id}` === key) ? s.filter((x) => `${x.kind}:${x.id}` !== key) : [...s, p]));
  }

  function enterFolder(id: string, oid?: string | null) {
    setFolderId(id);
    if (oid) setOwnerId(oid);
  }

  function enterRoot(r: { id: string | null; ownerId: string }) {
    if (tab === "public") setFolderId(r.id);
    else if (r.id) { setFolderId(r.id); setOwnerId(r.ownerId); }
    else { setFolderId(null); setOwnerId(r.ownerId); }
  }

  const needle = q.trim().toLowerCase();
  const showFolders = folders.filter((f) => !needle || f.name.toLowerCase().includes(needle));
  const showFiles = files.filter((f) => !needle || (f.stem ?? "").toLowerCase().includes(needle));
  const showRoots = roots.filter((r) => !needle || r.name.toLowerCase().includes(needle));

  function checkRow(kind: "q" | "f", id: string, name: string, sub: string, extra?: Partial<PickedRef>) {
    const key = `${kind}:${id}`;
    if (exclude.has(key)) return null;
    const on = selKeys.has(key);
    return (
      <button onClick={() => toggle({ kind, id, name, sub, ...extra })}
        className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-xs font-bold transition sm:h-6 sm:w-6", on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-transparent hover:border-slate-500")}>✓</button>
    );
  }

  return (
    <div className="yrk-sheet fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-3 sm:p-6" onClick={onClose}>
      <div className="flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-lift" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
          <div className="text-sm font-bold">Link content</div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex gap-1 border-b border-slate-100 px-4 py-2">
          {(["mine", "shared", "public"] as Tab[]).map((t) => (
            <button key={t} onClick={() => reset(t)}
              className={cn("rounded-lg px-3 py-1.5 text-[13px] font-semibold transition", tab === t ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100")}>
              {t === "mine" ? "My bank" : t === "shared" ? "Shared with me" : "Public folders"}
            </button>
          ))}
          <div className="relative ml-auto w-44">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <Input className="h-8 pl-8 text-[13px]" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        {crumbs.length > 1 && (
          <nav className="flex items-center gap-1 overflow-x-auto border-b border-slate-100 px-5 py-2 text-[13px]">
            {crumbs.map((c, i) => (
              <span key={i} className="flex shrink-0 items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-300" />}
                <button onClick={() => { setFolderId(c.id); setOwnerId(c.ownerId ?? null); }}
                  className={i === crumbs.length - 1 ? "font-semibold" : "text-indigo-600 hover:underline"}>{c.name}</button>
              </span>
            ))}
          </nav>
        )}
        <div className="grid flex-1 gap-1 overflow-y-auto p-3">
          {atRoot && (tab === "shared" || tab === "public") && showRoots.map((r) => (
            <div key={`${r.ownerId}:${r.id}`} className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-slate-50">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50"><Folder className="h-4 w-4 text-amber-500" fill="#fcd34d" /></span>
              <button className="min-w-0 flex-1 text-left" onClick={() => enterRoot(r)}>
                <span className="block truncate text-sm font-semibold">{r.name}</span>
                <span className="block truncate text-xs text-slate-400">{r.ownerName} · {r.role === "public-use" ? "public, usable" : r.role}</span>
              </button>
              {r.id && tab === "public" && checkRow("f", r.id, r.name, `Public · ${r.ownerName}`)}
            </div>
          ))}
          {showFolders.map((f) => (
            <div key={f.id} className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-slate-50">
              {checkRow("f", f.id, f.name, "Folder")}
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50"><Folder className="h-4 w-4 text-amber-500" fill="#fcd34d" /></span>
              <button className="min-w-0 flex-1 text-left" onClick={() => enterFolder(f.id)}>
                <span className="block truncate text-sm font-semibold">{f.name}</span>
                <span className="block truncate text-xs text-slate-400">Folder · tap to open</span>
              </button>
            </div>
          ))}
          {showFiles.map((f) => {
            const Icon = fileIcon(f.type);
            return (
              <div key={f.id} className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-slate-50">
                {checkRow("q", f.id, f.stem, `${f.type} · ${f.difficulty}`, { type: f.type, stem: f.stem, difficulty: f.difficulty })}
                <Icon className="h-4 w-4 shrink-0 text-indigo-500" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm">{f.stem}</span></span>
              </div>
            );
          })}
          {!showRoots.length && !showFolders.length && !showFiles.length && (
            <div className="px-2 py-8 text-center text-sm text-slate-400">
              {atRoot && tab !== "mine" ? "Nothing here yet." : "Empty folder — open one or check elsewhere."}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3">
          <span className="min-w-0 flex-1 truncate text-[13px] text-slate-500">
            {selected.length ? `${selected.length} selected` : "Check files and folders to link them"}
          </span>
          {selected.length > 0 && <Button size="sm" variant="outline" onClick={() => setSelected([])}>Clear</Button>}
          <Button size="sm" variant="accent" disabled={!selected.length} onClick={() => { onAdd(selected); setSelected([]); }}>
            <Check className="h-4 w-4" /> Add{selected.length ? ` ${selected.length}` : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}
