"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { DriveTree } from "@/components/drive-tree";
import { DriveGrid, DriveView, DriveFolderItem, DriveFile, GridAction, readDrag } from "@/components/drive-grid";
import { ImportModal } from "@/components/import-modal";
import { downloadFolderZip, downloadQuestionFile } from "@/lib/transport";
import { apiGet, apiSend } from "@/lib/api";
import { useSession } from "@/lib/use-session";
import { QuestionView } from "@/components/question-view";
import { QuestionEditor, QForm } from "@/components/question-editor";
import { Search, FolderPlus, FilePlus, ChevronRight, BookOpen, ArrowRight, ArrowLeft, ArrowUp, RefreshCw, Database, LayoutGrid, List, Share2, X, UserPlus, LogOut, Users, Upload, PanelLeft, MoreVertical } from "lucide-react";

interface TreeFolder { id: string; name: string; parentId?: string | null; ownerId?: string | null; shared?: boolean; ownerName?: string; access?: string; }
interface Crumb { id: string | null; name: string; ownerId: string; }
interface IncomingShare { id: string; folderId: string | null; folderName: string | null; ownerId: string; ownerName: string; role: string; }
interface ShareRow { id: string; userId: string; role: string; user: { name: string; email: string } | null; }

function fromUrl(): { folder: string | null; owner: string | null } {
  if (typeof window === "undefined") return { folder: null, owner: null };
  const p = new URLSearchParams(window.location.search);
  return { folder: p.get("folder"), owner: p.get("owner") };
}

export default function BankPage() {
  const [tab, setTab] = useState<"bank" | "explore">("bank");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null); // null = my bank
  const [tree, setTree] = useState<TreeFolder[]>([]);
  const [folders, setFolders] = useState<DriveFolderItem[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [sharedEntries, setSharedEntries] = useState<{ kind: string; id: string | null; name: string; ownerId: string; ownerName: string; role: string }[]>([]);
  const [incoming, setIncoming] = useState<IncomingShare[]>([]);
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: null, name: "My Bank", ownerId: "" }]);
  const [access, setAccess] = useState<string>("owner");
  const [ownerName, setOwnerName] = useState("");
  const [q, setQ] = useState("");
  const { user: me, loaded: authLoaded } = useSession();
  const [loading, setLoading] = useState(true);

  // modals
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewQ, setShowNewQ] = useState(false);
  const [topics, setTopics] = useState<{ id: string; name: string; subject: string; exam: string }[]>([]);
  const [viewId, setViewId] = useState<string | null>(null);
  const [viewQ, setViewQ] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [renameTarget, setRenameTarget] = useState<TreeFolder | null>(null);
  const [renameName, setRenameName] = useState("");
  const [moveTarget, setMoveTarget] = useState<DriveFile | null>(null);
  const [moveDest, setMoveDest] = useState<string>("");
  const [view, setView] = useState<DriveView>("details");
  const [dropCrumb, setDropCrumb] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [importScope, setImportScope] = useState<{ parentId: string | null; name: string } | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showTree, setShowTree] = useState(false);
  const [shareScope, setShareScope] = useState<string | null>(null); // folder being shared (null = root)
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState("viewer");
  const [shareRows, setShareRows] = useState<ShareRow[]>([]);
  const [pub, setPub] = useState<{ isPublic: boolean; publicAccess: string } | null>(null);

  const sharedMode = ownerId !== null;
  const canManage = access === "owner" || access === "editor";
  const canCreate = canManage || access === "reviewer";

  function setViewAndSave(v: DriveView) {
    setView(v);
    try { window.localStorage.setItem("drive-view", v); } catch { /* ignore */ }
  }

  useEffect(() => {
    const { folder, owner } = fromUrl();
    if (folder) setFolderId(folder);
    if (owner) setOwnerId(owner);
    try {
      if (window.localStorage.getItem("drive-view") === "tiles") setView("tiles");
    } catch { /* private mode */ }
    apiGet<{ id: string; name: string; subject: string; exam: string }[]>("/api/topics").then((r) => { if (r.ok && Array.isArray(r.data)) setTopics(r.data); });
  }, []);

  const loadTree = useCallback(() => {
    apiGet<TreeFolder[]>("/api/drive/folders").then((r) => { if (r.ok && Array.isArray(r.data)) setTree(r.data); });
    apiGet<IncomingShare[]>("/api/drive/shares/mine").then((r) => { if (r.ok && Array.isArray(r.data)) setIncoming(r.data); });
  }, []);

  const loadContents = useCallback((fid: string | null, oid: string | null) => {
    const params = new URLSearchParams();
    if (fid) params.set("folderId", fid);
    if (oid) params.set("ownerId", oid);
    apiGet<{ folders: DriveFolderItem[]; questions: DriveFile[]; breadcrumbs: Crumb[]; access: string; owner: { name: string }; sharedEntries: typeof sharedEntries }>(
      `/api/drive/contents${params.toString() ? `?${params.toString()}` : ""}`
    ).then((r) => {
      setLoading(false);
      if (!r.ok) {
        if (r.status === 401) { setFolders([]); setFiles([]); return; }
        if (r.status) toast(r.error);
        return;
      }
      const d = r.data!;
      setFolders(d.folders ?? []);
      const meId = me?.id;
      const qs = (d.questions ?? []) as DriveFile[];
      setFiles(qs.map(function (x) { const c = (x as { creatorId?: string }).creatorId; return { ...x, shared: Boolean(meId && c && c !== meId) }; }));
      setCrumbs(d.breadcrumbs ?? [{ id: null, name: "My Bank", ownerId: "" }]);
      setAccess(d.access ?? "owner");
      setOwnerName(d.owner?.name ?? "");
      setSharedEntries(d.sharedEntries ?? []);
    });
  }, [me?.id]);

  useEffect(() => { loadTree(); }, [loadTree]);
  useEffect(() => { if (tab === "bank") loadContents(folderId, ownerId); }, [folderId, ownerId, tab, loadContents]);

  function nav(fid: string | null, oid?: string | null) {
    const o = oid ?? null;
    setFolderId(fid);
    setOwnerId(o);
    const p = new URLSearchParams();
    if (fid) p.set("folder", fid);
    if (o) p.set("owner", o);
    window.history.replaceState(null, "", `/bank${p.toString() ? `?${p.toString()}` : ""}`);
  }

  // Sidebar tree select: shared folders carry their owner's id.
  function treeSelect(id: string | null, oid?: string | null) {
    if (id === null) { nav(null, null); return; }
    if (oid && me && oid !== me.id) nav(id, oid);
    else nav(id, null);
  }

  const visibleFiles = useMemo(() => {
    if (!q.trim()) return files;
    return files.filter((f) => (f.stem ?? "").toLowerCase().includes(q.toLowerCase()));
  }, [files, q]);

  // Shared entries merged inline at my own root (emerald).
  const gridFolders: DriveFolderItem[] = useMemo(() => {
    if (folderId || sharedMode) return folders;
    const entries: DriveFolderItem[] = sharedEntries.map((e) => ({
      id: e.id ?? `bank:${e.ownerId}`,
      name: e.name,
      ownerId: e.ownerId,
      ownerName: e.ownerName,
      role: e.role,
      shared: true,
    }));
    return [...folders, ...entries];
  }, [folders, sharedEntries, folderId, sharedMode]);

  function openFolder(id: string, oid?: string | null) {
    if (id.startsWith("bank:")) { nav(null, id.slice(5)); return; }
    if (oid && me && oid !== me.id) nav(id, oid);
    else nav(id, null);
  }

  async function createFolder() {
    if (!newFolderName.trim()) { toast("Give the folder a name."); return; }
    const r = await apiSend<{ name: string }>("/api/drive/folders", "POST", { name: newFolderName, parentId: folderId, ownerId: ownerId ?? undefined });
    if (!r.ok) { if (r.status) toast(r.error); return; }
    toast(`Folder “${r.data?.name}” created.`);
    setNewFolderName(""); setShowNewFolder(false);
    loadTree(); loadContents(folderId, ownerId);
  }

  async function createQuestion(f: QForm) {
    if (sharedMode && !folderId) { toast("Open or create a folder first — files live in folders here."); return; }
    const r = await apiSend("/api/drive/questions", "POST", { ...f, folderId });
    if (!r.ok) { if (r.status) toast(r.error); return; }
    toast("Question filed in this folder.");
    setShowNewQ(false);
    loadContents(folderId, ownerId);
  }

  function openFile(id: string, autoEdit = false) {
    setViewId(id); setViewQ(null); setEditing(false);
    apiGet<{ question: unknown }>("/api/bank/" + id).then((r) => {
      if (!r.ok) { if (r.status) toast(r.error); setViewId(null); return; }
      setViewQ(r.data?.question ?? null);
      if (autoEdit && r.data?.question) setEditing(true);
    });
  }

  async function saveEdit(f: QForm) {
    if (!viewId) return;
    const r = await apiSend<unknown>(`/api/bank/${viewId}`, "PATCH", { stem: f.stem, options: f.options, correct: f.correct, parts: f.parts, explanation: f.explanation, difficulty: f.difficulty, difficultyIndex: f.difficultyIndex, category: f.category, sector: f.sector, tags: f.tags, mediaUrl: f.mediaUrl });
    if (!r.ok) { if (r.status) toast(r.error); return; }
    toast("Question updated.");
    setEditing(false); setViewQ(r.data);
    loadContents(folderId, ownerId);
  }

  async function doRename() {
    if (!renameTarget || !renameName.trim()) return;
    const r = await apiSend(`/api/drive/folders/${renameTarget.id}`, "PATCH", { name: renameName });
    if (!r.ok) { if (r.status) toast(r.error); return; }
    toast("Folder renamed.");
    setRenameTarget(null);
    loadTree(); loadContents(folderId, ownerId);
  }

  async function doDeleteFolder(id: string) {
    if (!confirm("Delete this folder? It must be empty first.")) return;
    const r = await apiSend(`/api/drive/folders/${id}`, "DELETE");
    if (!r.ok) { if (r.status) toast(r.error); return; }
    toast("Folder deleted.");
    loadTree(); loadContents(folderId, ownerId);
  }

  async function doMoveFile() {
    if (!moveTarget) return;
    const r = await apiSend(`/api/bank/${moveTarget.id}`, "PATCH", { folderId: moveDest || null });
    if (!r.ok) { if (r.status) toast(r.error); return; }
    toast("Question moved.");
    setMoveTarget(null);
    loadContents(folderId, ownerId);
  }

  async function moveItem(kind: "file" | "folder", id: string, dest: string | null) {
    if (dest?.startsWith("bank:")) { toast("Open that bank first, then drop into a folder."); return; }
    const url = kind === "file" ? `/api/bank/${id}` : `/api/drive/folders/${id}`;
    const body = kind === "file" ? { folderId: dest } : { parentId: dest };
    const r = await apiSend(url, "PATCH", body);
    if (!r.ok) { if (r.status) toast(r.error || "Move failed"); return; }
    toast(kind === "file" ? "Question moved." : "Folder moved.");
    loadTree(); loadContents(folderId, ownerId);
  }

  function gridAction(kind: GridAction, id: string) {
    if (kind === "rename-folder") {
      const f = [...tree, ...folders].find((x) => x.id === id) ?? null;
      if (f) { setRenameTarget(f as TreeFolder); setRenameName(f.name); }
    } else if (kind === "delete-folder") doDeleteFolder(id);
    else if (kind === "share-folder" || kind === "assigned-folder") openShare(id);
    else if (kind === "publish-folder") doPublishFolder(id);
    else if (kind === "download-folder") doDownloadFolder(id);
    else if (kind === "copy-folder") doCopyFolder(id);
    else if (kind === "import-folder") {
      const f = [...folders, ...tree].find((x) => x.id === id);
      setImportScope({ parentId: id, name: f?.name ?? "folder" });
    }
    else if (kind === "edit-file") openFile(id, true);
    else if (kind === "delete-file") doDeleteFile(id);
    else if (kind === "download-file") doDownloadFile(id);
    else if (kind === "assign-file") {
      const fl = files.find((x) => x.id === id) ?? null;
      openShare(fl?.folderId ?? null);
    } else if (kind === "move-file") {
      const fl = files.find((x) => x.id === id) ?? null;
      if (fl) { setMoveTarget(fl); setMoveDest(""); }
    }
  }

  async function doDownloadFolder(id: string) {
    toast("Preparing download…");
    const r = await apiGet<{ bundle: Parameters<typeof downloadFolderZip>[0]; truncated?: boolean }>(`/api/drive/export?folderId=${id}`);
    if (!r.ok) { if (r.status) toast(r.error || "Export failed"); return; }
    if (!r.data?.bundle) { toast("Export failed"); return; }
    try {
      await downloadFolderZip(r.data.bundle);
      toast("Real folder downloaded.");
    } catch { toast("Couldn't build the zip."); }
    if (r.data.truncated) toast("Large folder — export capped at 500 questions.");
  }

  async function doCopyFolder(id: string) {
    const r = await apiSend<{ questions: number }>(`/api/drive/folders/${id}/copy`, "POST", {});
    if (!r.ok) { if (r.status) toast(r.error || "Copy failed"); return; }
    toast(`Copied — ${r.data?.questions ?? 0} questions.`);
    loadTree(); loadContents(folderId, ownerId);
  }

  function doDownloadFile(id: string) {
    const open = viewQ && viewId === id ? viewQ : null;
    if (open) {
      downloadQuestionFile(open);
      toast("Question file downloaded.");
      return;
    }
    apiGet<{ question: Parameters<typeof downloadQuestionFile>[0] | null }>(`/api/bank/${id}`).then((r) => {
      if (!r.ok || !r.data?.question) { if (!r.ok && r.status) toast(r.error); else if (!r.data?.question) toast("Couldn't load that file."); return; }
      downloadQuestionFile(r.data.question);
      toast("Question file downloaded.");
    });
  }

  async function doDeleteFile(id: string) {
    if (!confirm("Delete this question file? History stays, the file goes.")) return;
    const r = await apiSend(`/api/bank/${id}`, "DELETE");
    if (!r.ok) { if (r.status) toast(r.error); return; }
    toast("File deleted.");
    if (viewId === id) { setViewId(null); setViewQ(null); }
    loadContents(folderId, ownerId);
  }

  async function doPublishFolder(id: string) {
    const f = [...folders, ...tree].find((x) => x.id === id) as (TreeFolder & { isPublic?: boolean; publicAccess?: string }) | undefined;
    const next = !(f as { isPublic?: boolean } | undefined)?.isPublic;
    const r = await apiSend(`/api/drive/folders/${id}`, "PATCH", { isPublic: next, ...(next ? { publicAccess: (f as { publicAccess?: string } | undefined)?.publicAccess ?? "view" } : {}) });
    if (!r.ok) { if (r.status) toast(r.error); return; }
    toast(next ? "Folder is public — find it in the archive." : "Folder is private again.");
    loadTree(); loadContents(folderId, ownerId);
  }

  // ---- sharing (scoped to a folder, or the viewed root) ----
  function openShare(scope?: string | null) {
    const s = scope !== undefined ? scope : folderId;
    setShareScope(s);
    setShareEmail(""); setShareRole("viewer"); setShowShare(true);
    setPub(null);
    loadShares(s);
    if (s) {
      apiGet<{ current: { isPublic?: boolean; publicAccess?: string } | null }>(`/api/drive/contents?folderId=${s}`).then((r) => {
        const c = r.ok ? r.data?.current : null;
        if (c) setPub({ isPublic: !!c.isPublic, publicAccess: c.publicAccess ?? "view" });
      });
    }
  }

  function loadShares(scope?: string | null) {
    const s = scope !== undefined ? scope : shareScope;
    const p = new URLSearchParams();
    if (s) p.set("folderId", s);
    apiGet<ShareRow[]>(`/api/drive/shares${p.toString() ? `?${p.toString()}` : ""}`).then((r) => { if (r.ok && Array.isArray(r.data)) setShareRows(r.data); });
  }

  async function invite() {
    if (!shareEmail.trim()) { toast("Enter their email."); return; }
    const r = await apiSend(`/api/drive/shares`, "POST", { email: shareEmail, role: shareRole, folderId: shareScope });
    if (!r.ok) { if (r.status) toast(r.error); return; }
    toast(`Shared as ${shareRole}.`);
    setShareEmail("");
    loadShares();
  }

  async function unshare(id: string) {
    const r = await apiSend(`/api/drive/shares/${id}`, "DELETE");
    if (!r.ok) { if (r.status) toast(r.error); return; }
    toast("Share removed.");
    loadShares();
  }

  async function leave(id: string) {
    if (!confirm("Leave this shared bank? It will vanish from your drive.")) return;
    const r = await apiSend(`/api/drive/shares/${id}`, "DELETE");
    if (!r.ok) { if (r.status) toast(r.error); return; }
    toast("Left the shared bank.");
    if (ownerId) nav(null, null);
    loadTree(); loadContents(folderId, ownerId);
  }

  const bankFolders = useMemo(() => {
    if (!ownerId) return tree.filter((f) => !f.shared);
    return tree.filter((f) => f.ownerId === ownerId);
  }, [tree, ownerId]);

  const myTree = useMemo(() => tree.filter((f) => !f.shared), [tree]);

  return (
    <div className="grid gap-4">
      {/* tab switch */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-xl bg-slate-100 dark:bg-white/[0.07] p-1 text-[13px] font-semibold">
          <button onClick={() => setTab("bank")} className={`rounded-lg px-3.5 py-1.5 transition ${tab === "bank" ? "bg-white dark:bg-[var(--yrk-surface-elevated)] text-slate-900 dark:text-[var(--yrk-text-primary)] shadow-sm" : "text-slate-500 dark:text-[#9aa3b2]"}`}>My Bank</button>
          <button onClick={() => setTab("explore")} className={`rounded-lg px-3.5 py-1.5 transition ${tab === "explore" ? "bg-white dark:bg-[var(--yrk-surface-elevated)] text-slate-900 dark:text-[var(--yrk-text-primary)] shadow-sm" : "text-slate-500 dark:text-[#9aa3b2]"}`}>Explore</button>
        </div>
        {tab === "bank" && authLoaded && !me && <span className="text-[13px] text-slate-400 dark:text-[var(--yrk-text-tertiary)]"><a className="text-brand-600 underline" href="/login">Log in</a> to use your bank.</span>}
        {tab === "bank" && sharedMode && <Badge tone="in_review">Viewing {ownerName}&rsquo;s bank · {access}</Badge>}
      </div>

      {tab === "explore" ? (
        <ExploreTab />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[260px_1fr]">
          {/* navigation pane */}
          <Card className="hidden lg:block"><CardContent className="p-3">
            <BankNav myTree={myTree} incoming={incoming} folderId={folderId} ownerId={ownerId}
              sharedMode={sharedMode} meId={me?.id} canCreate={canCreate}
              onTreeSelect={treeSelect} onMoveItem={moveItem} onNav={nav} onLeave={leave}
              onNewFolder={() => setShowNewFolder(true)} />
          </CardContent></Card>

          <div className="grid gap-0">
            {/* Explorer command bar: back / up / refresh + address bar + search */}
            <Card className="rounded-b-none border-b-0"><CardContent className="flex items-center gap-1.5 p-2.5">
              <button title="Back" disabled={crumbs.length < 2} onClick={() => { const p = crumbs[crumbs.length - 2]; nav(p?.id ?? null, p && p.ownerId && me?.id !== p.ownerId ? p.ownerId : null); }} className="rounded-lg p-2 text-slate-500 dark:text-[#9aa3b2] transition hover:bg-slate-100 dark:hover:bg-white/[0.07] disabled:opacity-30"><ArrowLeft className="h-4 w-4" /></button>
              <button title="Up one level" disabled={crumbs.length < 2} onClick={() => { const p = crumbs[crumbs.length - 2]; nav(p?.id ?? null, p && p.ownerId && me?.id !== p.ownerId ? p.ownerId : null); }} className="rounded-lg p-2 text-slate-500 dark:text-[#9aa3b2] transition hover:bg-slate-100 dark:hover:bg-white/[0.07] disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
              <button title="Refresh" onClick={() => { loadTree(); loadContents(folderId, ownerId); }} className="rounded-lg p-2 text-slate-500 dark:text-[#9aa3b2] transition hover:bg-slate-100 dark:hover:bg-white/[0.07]"><RefreshCw className="h-4 w-4" /></button>
              {/* address bar */}
              <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded-lg border border-slate-200 dark:border-[var(--yrk-border-subtle)] bg-slate-50/60 dark:bg-white/[0.04] px-2 py-1.5 text-[13px]">
                {crumbs.map((c, i) => {
                  const cOwner = c.ownerId && me?.id !== c.ownerId ? c.ownerId : null;
                  const key = `${c.id ?? "__root__"}:${c.ownerId}`;
                  return (
                    <span
                      key={`${key}-${i}`}
                      className="flex shrink-0 items-center gap-0.5"
                      onDragOver={c.id ? (e) => { e.preventDefault(); e.stopPropagation(); setDropCrumb(key); } : undefined}
                      onDragLeave={() => setDropCrumb((t) => (t === key ? null : t))}
                      onDrop={c.id ? (e) => {
                        e.preventDefault(); e.stopPropagation(); setDropCrumb(null);
                        const d = readDrag(e);
                        if (!d || d.id === c.id) return;
                        moveItem(d.kind, d.id, c.id);
                      } : undefined}
                    >
                      {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-300" />}
                      <button onClick={() => nav(c.id, cOwner)} className={`flex items-center gap-1.5 rounded-md px-1.5 py-0.5 ${dropCrumb === key ? "bg-brand-100 ring-1 ring-brand-300" : ""} ${i === crumbs.length - 1 ? "font-semibold text-slate-900 dark:text-[var(--yrk-text-primary)]" : "text-slate-600 dark:text-[var(--yrk-text-secondary)] hover:bg-slate-200/60"}`}>
                        {i === 0 && <Database className={`h-3.5 w-3.5 ${sharedMode ? "text-emerald-600" : "text-brand-500"}`} />}{c.name}
                      </button>
                    </span>
                  );
                })}
              </nav>
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-[var(--yrk-text-tertiary)]" />
                <Input className="w-44 pl-9" placeholder={`Search ${crumbs[crumbs.length - 1]?.name ?? ""}`} value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </CardContent></Card>
            {/* ribbon: icon-led actions, fits 360px with zero scroll */}
            <div className="grid gap-2 rounded-b-xl border border-t-0 border-slate-200 dark:border-[var(--yrk-border-subtle)] bg-white dark:bg-[var(--yrk-surface-elevated)] px-2.5 py-2.5 shadow-soft">
              <div className="relative sm:hidden">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-[var(--yrk-text-tertiary)]" />
                <Input className="w-full pl-9" placeholder={`Search ${crumbs[crumbs.length - 1]?.name ?? ""}`} value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <div className="flex items-center gap-1.5">
                <RibbonIcon title="Folders" onClick={() => setShowTree(true)} className="lg:hidden">
                  <PanelLeft className="h-5 w-5" />
                </RibbonIcon>
                {canCreate && !(sharedMode && !folderId) && (
                  <RibbonIcon title="New question" primary onClick={() => setShowNewQ(true)}>
                    <FilePlus className="h-5 w-5" />
                  </RibbonIcon>
                )}
                {canCreate && (
                  <RibbonIcon title="New folder" onClick={() => setShowNewFolder(true)}>
                    <FolderPlus className="h-5 w-5" />
                  </RibbonIcon>
                )}
                <span className="min-w-0 flex-1 truncate text-xs text-slate-400 dark:text-[var(--yrk-text-tertiary)]">
                  {crumbs.length > 1 ? `${folders.length + files.length} items` : ""}
                </span>
                {/* view switcher */}
                <div className="flex shrink-0 rounded-lg border border-slate-200 dark:border-[var(--yrk-border-subtle)] p-0.5">
                  <button title="Details view" onClick={() => setViewAndSave("details")} className={`rounded-md p-2 transition sm:p-1.5 ${view === "details" ? "bg-slate-900 text-white" : "text-slate-400 dark:text-[var(--yrk-text-tertiary)] hover:text-slate-600 dark:text-[var(--yrk-text-secondary)]"}`}><List className="h-4 w-4" /></button>
                  <button title="Tiles view" onClick={() => setViewAndSave("tiles")} className={`rounded-md p-2 transition sm:p-1.5 ${view === "tiles" ? "bg-slate-900 text-white" : "text-slate-400 dark:text-[var(--yrk-text-tertiary)] hover:text-slate-600 dark:text-[var(--yrk-text-secondary)]"}`}><LayoutGrid className="h-4 w-4" /></button>
                </div>
                <div className="relative shrink-0">
                  <RibbonIcon title="More actions" onClick={() => setMoreOpen((v) => !v)}>
                    <MoreVertical className="h-5 w-5" />
                  </RibbonIcon>
                  {moreOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMoreOpen(false)} />
                      <div className="absolute right-0 top-11 z-20 grid w-44 overflow-hidden rounded-xl border border-slate-200 dark:border-[var(--yrk-border-subtle)] bg-white dark:bg-[var(--yrk-surface-elevated)] py-1 shadow-lift">
                        {canCreate && !(sharedMode && !folderId) && (
                          <button className="flex items-center gap-2.5 px-3 py-2.5 text-left text-[13px] hover:bg-slate-50 dark:hover:bg-white/[0.05] dark:bg-[var(--yrk-surface-canvas)]" onClick={() => { setMoreOpen(false); setImportScope({ parentId: folderId, name: crumbs[crumbs.length - 1]?.name ?? "My Bank" }); }}>
                            <Upload className="h-4 w-4 text-slate-400 dark:text-[var(--yrk-text-tertiary)]" /> Import files
                          </button>
                        )}
                        {access === "owner" && (
                          <button className="flex items-center gap-2.5 px-3 py-2.5 text-left text-[13px] hover:bg-slate-50 dark:hover:bg-white/[0.05] dark:bg-[var(--yrk-surface-canvas)]" onClick={() => { setMoreOpen(false); openShare(); }}>
                            <Share2 className="h-4 w-4 text-slate-400 dark:text-[var(--yrk-text-tertiary)]" /> Share this {folderId ? "folder" : "bank"}
                          </button>
                        )}
                        <button className="flex items-center gap-2.5 px-3 py-2.5 text-left text-[13px] hover:bg-slate-50 dark:hover:bg-white/[0.05] dark:bg-[var(--yrk-surface-canvas)]" onClick={() => { setMoreOpen(false); loadTree(); loadContents(folderId, ownerId); }}>
                          <RefreshCw className="h-4 w-4 text-slate-400 dark:text-[var(--yrk-text-tertiary)]" /> Refresh
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3">
            {loading ? (
              <div className="grid gap-2 overflow-hidden rounded-xl border border-slate-200 dark:border-[var(--yrk-border-subtle)] bg-white dark:bg-[var(--yrk-surface-elevated)] p-3 shadow-soft">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="h-[18px] w-[18px] shrink-0 animate-pulse rounded-md bg-slate-100 dark:bg-white/[0.07]" />
                    <span className="h-4 flex-1 animate-pulse rounded-md bg-slate-100 dark:bg-white/[0.07]" style={{ width: `${82 - i * 9}%` }} />
                  </div>
                ))}
              </div>
            ) : (
            <DriveGrid
              folders={gridFolders}
              files={visibleFiles}
              view={view}
              canManage={canManage}
              isOwn={!sharedMode}
              sharedBy={ownerName}
              onOpenFolder={openFolder}
              onOpenFile={openFile}
              onAction={gridAction}
              onMove={moveItem}
            />
            )}
            </div>
          </div>
        </div>
      )}

      {/* new folder modal */}
      {showNewFolder && (
        <Modal onClose={() => setShowNewFolder(false)} title={`New folder${crumbs.length > 1 ? ` in “${crumbs[crumbs.length - 1].name}”` : sharedMode ? ` in ${ownerName}'s bank` : " in My Bank"}`}>
          <Input placeholder="e.g. Physics — Mechanics" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createFolder()} />
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowNewFolder(false)}>Cancel</Button><Button variant="accent" onClick={createFolder}>Create</Button></div>
        </Modal>
      )}

      {/* new question modal */}
      {showNewQ && (
        <div className="yrk-sheet fixed inset-0 z-40 overflow-y-auto bg-slate-900/50 p-3 sm:p-6" onClick={() => setShowNewQ(false)}>
          <div className="mx-auto max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between text-white">
              <span className="text-sm font-semibold">New question in “{crumbs[crumbs.length - 1]?.name}”</span>
              <button onClick={() => setShowNewQ(false)} className="rounded-lg bg-white/10 p-1.5 hover:bg-white/20"><X className="h-4 w-4" /></button>
            </div>
            <QuestionEditor topics={topics} submitLabel="File question" strict onSubmit={createQuestion} />
          </div>
        </div>
      )}

      {/* file viewer */}
      {viewId && viewQ && !editing && (
        <QuestionView q={viewQ} canEdit={!!me && (viewQ.creatorId === me.id || canManage)} onEdit={() => setEditing(true)} onClose={() => { setViewId(null); setViewQ(null); }} />
      )}

      {/* edit from viewer */}
      {viewId && viewQ && editing && (
        <div className="yrk-sheet fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 p-3 sm:p-6" onClick={() => setEditing(false)}>
          <div className="mx-auto max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between text-white">
              <span className="text-sm font-semibold">Edit question</span>
              <button onClick={() => setEditing(false)} className="rounded-lg bg-white/10 p-1.5 hover:bg-white/20"><X className="h-4 w-4" /></button>
            </div>
            <QuestionEditor
              initial={{ type: viewQ.type, stem: viewQ.stem, options: JSON.parse(viewQ.options || "[]"), correct: JSON.parse(viewQ.correct || "[]"), parts: (() => { try { return JSON.parse(viewQ.parts || "[]"); } catch { return []; } })(), explanation: viewQ.explanation, difficulty: viewQ.difficulty, difficultyIndex: viewQ.difficultyIndex ?? 3, category: viewQ.category ?? "tertiary", sector: viewQ.sector ?? "", tags: (() => { try { return JSON.parse(viewQ.tags || "[]"); } catch { return []; } })(), mediaUrl: viewQ.mediaUrl ?? "" }}
              topics={topics}
              submitLabel="Save changes"
              onSubmit={saveEdit}
            />
          </div>
        </div>
      )}

      {/* rename modal */}
      {renameTarget && (
        <Modal onClose={() => setRenameTarget(null)} title={`Rename “${renameTarget.name}”`}>
          <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doRename()} />
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setRenameTarget(null)}>Cancel</Button><Button variant="accent" onClick={doRename}>Rename</Button></div>
        </Modal>
      )}

      {/* move modal */}
      {moveTarget && (
        <Modal onClose={() => setMoveTarget(null)} title="Move question to…">
          <select className="yrk-select w-full rounded-xl border border-slate-200 dark:border-[var(--yrk-border-subtle)] bg-white dark:bg-[var(--yrk-surface-elevated)] px-3 py-2.5 text-sm" value={moveDest} onChange={(e) => setMoveDest(e.target.value)}>
            {!sharedMode && <option value="">My Bank (root)</option>}
            {bankFolders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setMoveTarget(null)}>Cancel</Button><Button variant="accent" onClick={doMoveFile}>Move</Button></div>
        </Modal>
      )}

      {/* folders drawer (mobile) */}
      {showTree && (
        <div className="yrk-sheet fixed inset-0 z-40 grid place-items-center bg-slate-900/50 p-4 lg:hidden" onClick={() => setShowTree(false)}>
          <div className="grid max-h-[85dvh] w-full gap-1 overflow-y-auto rounded-3xl bg-white dark:bg-[var(--yrk-surface-elevated)] p-4 shadow-lift" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-1 pb-1">
              <div className="text-sm font-bold">Folders</div>
              <button onClick={() => setShowTree(false)} className="rounded-lg p-2 text-slate-400 dark:text-[var(--yrk-text-tertiary)] hover:bg-slate-100 dark:hover:bg-white/[0.07]"><X className="h-4 w-4" /></button>
            </div>
            <div onClick={() => setShowTree(false)}>
              <BankNav myTree={myTree} incoming={incoming} folderId={folderId} ownerId={ownerId}
                sharedMode={sharedMode} meId={me?.id} canCreate={canCreate}
                onTreeSelect={(id, oid) => { treeSelect(id, oid); }} onMoveItem={(k, id, dest) => { setShowTree(false); moveItem(k, id, dest); }} onNav={nav} onLeave={leave}
                onNewFolder={() => { setShowTree(false); setShowNewFolder(true); }} />
            </div>
          </div>
        </div>
      )}

      {/* import modal */}
      {importScope && (
        <ImportModal scopeName={importScope.name} parentId={importScope.parentId}
          onDone={() => { setImportScope(null); loadTree(); loadContents(folderId, ownerId); }}
          onClose={() => setImportScope(null)} />
      )}

      {/* share modal (scoped to a folder, or the viewed root) */}
      {showShare && (
        <div className="yrk-sheet fixed inset-0 z-40 grid place-items-center bg-slate-900/50 p-4" onClick={() => setShowShare(false)}>
          <div className="grid max-h-[90dvh] w-full max-w-md gap-3 overflow-y-auto rounded-3xl bg-white dark:bg-[var(--yrk-surface-elevated)] p-5 shadow-lift" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2">
              <div className="truncate text-sm font-bold">Share {shareScope ? `“${[...folders, ...tree].find((f) => f.id === shareScope)?.name ?? "folder"}”` : "bank root"}</div>
              <button onClick={() => setShowShare(false)} className="rounded-lg p-1.5 text-slate-400 dark:text-[var(--yrk-text-tertiary)] hover:bg-slate-100 dark:hover:bg-white/[0.07]"><X className="h-4 w-4" /></button>
            </div>
            <div className="text-[13px] text-slate-500 dark:text-[#9aa3b2]">Viewer reads · reviewer reads + adds · editor manages. They must already have an account.</div>
            <div className="flex gap-2">
              <Input className="flex-1" placeholder="teammate@example.com" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && invite()} />
              <Select className="w-auto" value={shareRole} onChange={(e) => setShareRole(e.target.value)}>
                <option value="viewer">Viewer</option><option value="reviewer">Reviewer</option><option value="editor">Editor</option>
              </Select>
              <Button variant="accent" onClick={invite}><UserPlus className="h-4 w-4" /></Button>
            </div>
            {shareScope && (
              <div className="grid gap-2 rounded-2xl border border-slate-100 dark:border-[var(--yrk-border-subtle)] p-3">
                <label className="flex cursor-pointer items-center justify-between gap-2 text-sm">
                  <span className="font-semibold">Public folder <span className="block text-xs font-normal text-slate-400 dark:text-[var(--yrk-text-tertiary)]">Listed in the archive for everyone.</span></span>
                  <button onClick={async () => {
                    const next = !(pub?.isPublic ?? false);
                    const res = await fetch(`/api/drive/folders/${shareScope}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPublic: next }) });
                    if (!res.ok) { toast((await res.json()).error); return; }
                    setPub({ isPublic: next, publicAccess: pub?.publicAccess ?? "view" });
                    toast(next ? "Folder is public." : "Folder is private again.");
                  }} className={`relative h-6 w-11 shrink-0 rounded-full transition ${pub?.isPublic ? "bg-emerald-500" : "bg-slate-200 dark:bg-white/10"}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white dark:bg-[var(--yrk-surface-elevated)] shadow transition ${pub?.isPublic ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </label>
                {pub?.isPublic && (
                  <label className="yrk-label">Public access
                    <Select value={pub.publicAccess} onChange={async (e) => {
                      const res = await fetch(`/api/drive/folders/${shareScope}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publicAccess: e.target.value }) });
                      if (!res.ok) { toast((await res.json()).error); return; }
                      setPub({ isPublic: true, publicAccess: e.target.value });
                      toast("Access updated.");
                    }}>
                      <option value="view">View — read-only browsing</option>
                      <option value="use">Use — playable + addable to activities</option>
                    </Select>
                  </label>
                )}
              </div>
            )}
            <div className="grid gap-1.5">
              {shareRows.map((s) => (                <div key={s.id} className="flex items-center gap-2 rounded-xl border border-slate-100 dark:border-[var(--yrk-border-subtle)] px-3 py-2 text-sm">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-xs font-bold text-brand-700">{s.user?.name?.charAt(0).toUpperCase() ?? "?"}</span>
                  <span className="min-w-0 flex-1 truncate">{s.user?.name ?? s.userId}<span className="block truncate text-xs text-slate-400 dark:text-[var(--yrk-text-tertiary)]">{s.user?.email}</span></span>
                  <Select className="w-auto" value={s.role} onChange={async (e) => {
                    const res = await fetch("/api/drive/shares", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: s.user?.email, role: e.target.value, folderId: shareScope }) });
                    if (!res.ok) toast((await res.json()).error); else { toast("Role updated."); loadShares(); }
                  }}>
                    <option value="viewer">Viewer</option><option value="reviewer">Reviewer</option><option value="editor">Editor</option>
                  </Select>
                  <button className="rounded-md p-1.5 text-slate-300 hover:bg-red-50 dark:bg-red-950 hover:text-red-600" title="Remove" onClick={() => unshare(s.id)}><X className="h-4 w-4" /></button>
                </div>
              ))}
              {!shareRows.length && <div className="text-[13px] text-slate-400 dark:text-[var(--yrk-text-tertiary)]">Only you — invite someone above.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Navigation pane content, shared by the desktop sidebar and the mobile folders sheet.
function BankNav({ myTree, incoming, folderId, ownerId, sharedMode, meId, canCreate, onTreeSelect, onMoveItem, onNav, onLeave, onNewFolder }: {
  myTree: TreeFolder[]; incoming: IncomingShare[]; folderId: string | null; ownerId: string | null;
  sharedMode: boolean; meId?: string; canCreate: boolean;
  onTreeSelect: (id: string | null, oid?: string | null) => void;
  onMoveItem: (kind: "file" | "folder", id: string, dest: string | null) => void;
  onNav: (fid: string | null, oid?: string | null) => void;
  onLeave: (id: string) => void;
  onNewFolder: () => void;
}) {
  void meId;
  return (
    <div className="grid gap-3">
      <div>
        <div className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-[var(--yrk-text-tertiary)]">Quick access</div>
        <DriveTree folders={myTree} currentId={sharedMode ? null : folderId} onSelect={onTreeSelect} onDropMove={onMoveItem} />
      </div>
      {!!incoming.length && (
        <div>
          <div className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-[var(--yrk-text-tertiary)]">Shared with me</div>
          <div className="grid gap-0.5">
            {incoming.map((s) => (
              <div key={s.id} className="group flex items-center gap-1">
                <button
                  onClick={() => onNav(s.folderId, s.ownerId)}
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition sm:py-1.5 sm:text-[13px] ${folderId === s.folderId && ownerId === s.ownerId ? "bg-brand-50 font-semibold text-brand-800" : "text-slate-600 dark:text-[var(--yrk-text-secondary)] hover:bg-slate-100 dark:hover:bg-white/[0.07]"}`}
                >
                  <Users className="h-4 w-4 shrink-0 text-slate-400 dark:text-[var(--yrk-text-tertiary)] sm:h-3.5 sm:w-3.5" />
                  <span className="min-w-0 flex-1 truncate">{s.folderName ?? `${s.ownerName}'s bank`}</span>
                  <span className="shrink-0 text-[10px] font-bold uppercase text-slate-400 dark:text-[var(--yrk-text-tertiary)]">{s.role}</span>
                </button>
                <button title="Leave" onClick={() => onLeave(s.id)} className="rounded-md p-2 text-slate-300 transition hover:bg-red-50 dark:bg-red-950 hover:text-red-600 sm:opacity-0 sm:p-1 sm:group-hover:opacity-100"><LogOut className="h-4 w-4 sm:h-3.5 sm:w-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      )}
      {canCreate && !sharedMode && <Button size="sm" variant="outline" className="w-full" onClick={onNewFolder}><FolderPlus className="h-3.5 w-3.5" /> New folder</Button>}
    </div>
  );
}

// Icon-led ribbon button: 44px touch target, tooltip label, no text clutter.
function RibbonIcon({ title, onClick, primary, className, children }: {
  title: string; onClick: () => void; primary?: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <button title={title} aria-label={title} onClick={onClick}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition active:scale-95 ${primary ? "border-brand-600 bg-brand-600 text-white shadow-sm hover:bg-brand-500" : "border-slate-200 dark:border-[var(--yrk-border-subtle)] bg-white dark:bg-[var(--yrk-surface-elevated)] text-slate-600 dark:text-[var(--yrk-text-secondary)] hover:border-slate-300 dark:hover:border-[var(--yrk-border-default)] dark:border-[var(--yrk-border-default)] hover:bg-slate-50 dark:hover:bg-white/[0.05] dark:bg-[var(--yrk-surface-canvas)]"} ${className ?? ""}`}>
      {children}
    </button>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {  return (
    <div className="yrk-sheet fixed inset-0 z-40 grid place-items-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="grid w-full max-w-sm gap-3 rounded-3xl bg-white dark:bg-[var(--yrk-surface-elevated)] p-5 shadow-lift" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <div className="truncate text-sm font-bold">{title}</div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 dark:text-[var(--yrk-text-tertiary)] hover:bg-slate-100 dark:hover:bg-white/[0.07]"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ExploreTab() {
  const [all, setAll] = useState<{ id: string; name: string; course: string; session: string; description: string; topics: number; questionCount: number }[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => { fetch("/api/subjects").then((r) => r.json()).then((d) => setAll(Array.isArray(d) ? d : [])); }, []);
  const items = all.filter((s) => !q || (s.name + " " + s.description + " " + s.course).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="grid gap-4">
      <Card><CardContent className="flex gap-2 p-4">
        <div className="relative flex-1"><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-[var(--yrk-text-tertiary)]" /><Input className="pl-10" placeholder="Search the shared bank…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </CardContent></Card>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((s) => (
          <Card key={s.id} className="transition hover:shadow-lift">
            <CardContent className="grid gap-2 p-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-600">{s.session} · {s.course}</div>
              <div className="flex items-center gap-2 text-lg font-bold"><BookOpen className="h-4 w-4 text-brand-600" />{s.name}</div>
              <div className="text-sm text-slate-500 dark:text-[#9aa3b2]">{s.description} · {s.topics} topics · {s.questionCount} questions</div>
              <a href={`/bank/subject/${s.id}`}><Button variant="secondary" size="sm">Open subject <ArrowRight className="h-3.5 w-3.5" /></Button></a>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
