import { Folder, ListChecks, CheckSquare, ToggleLeft, ListTodo, Scale, PenLine, PencilLine, FileText, ScrollText, Layers, FileStack, Puzzle, Shuffle, KeyRound, Stethoscope, ClipboardCheck, ClipboardList, Users, Mic, MoreVertical, FolderOpen } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type DriveView = "details" | "tiles";

export interface DriveFile {
  id: string;
  stem: string;
  type: string;
  difficulty: string;
  createdAt?: string;
  creatorId?: string;
  folderId?: string | null;
  shared?: boolean;
}

export interface DriveFolderItem {
  id: string;
  name: string;
  createdAt?: string;
  ownerId?: string | null;
  ownerName?: string;
  role?: string;
  shared?: boolean;
  isPublic?: boolean;
}

export type GridAction =
  | "rename-folder" | "delete-folder" | "move-file" | "delete-file"
  | "share-folder" | "assigned-folder" | "publish-folder"
  | "download-folder" | "copy-folder" | "import-folder"
  | "edit-file" | "assign-file" | "download-file";

export interface DragPayload {
  kind: "file" | "folder";
  id: string;
}

export interface MenuItem {
  label: string;
  danger?: boolean;
  run: () => void;
}

export function fileIcon(type: string) {
  switch (type) {
    case "mcq": return ListChecks;
    case "multi_select": return CheckSquare;
    case "true_false": return ToggleLeft;
    case "mtf": return ListTodo;
    case "sct": return Scale;
    case "fill_in": return PenLine;
    case "saq": return PencilLine;
    case "short_answer": return FileText;
    case "essay": return ScrollText;
    case "compound": return Layers;
    case "meq": return FileStack;
    case "matching": return Puzzle;
    case "emq": return Shuffle;
    case "kfq": return KeyRound;
    case "osce": return Stethoscope;
    case "dops": return ClipboardCheck;
    case "minicex": return ClipboardList;
    case "msf": return Users;
    case "viva": return Mic;
    default: return FileText;
  }
}

const TYPE_SHORT: Record<string, string> = {
  mcq: "MCQ", multi_select: "Multi-select", true_false: "True / False", mtf: "MTF",
  sct: "SCT", fill_in: "Fill-in", saq: "SAQ", short_answer: "Short answer",
  essay: "Essay / LEQ", compound: "Compound", meq: "MEQ", matching: "Matching",
  emq: "EMQ", kfq: "KFQ", osce: "OSCE rubric", dops: "DOPS", minicex: "Mini-CEX",
  msf: "MSF", viva: "Viva",
};

export function typeLabel(type: string | undefined | null) {
  if (!type) return "Question";
  return TYPE_SHORT[type] ?? String(type).replace(/_/g, " ");
}

export function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function readDrag(e: React.DragEvent): DragPayload | null {
  try {
    const d = JSON.parse(e.dataTransfer.getData("text/plain"));
    if ((d.kind === "file" || d.kind === "folder") && typeof d.id === "string") return d;
  } catch { /* not ours */ }
  return null;
}

export function startDrag(e: React.DragEvent, payload: DragPayload) {
  e.dataTransfer.setData("text/plain", JSON.stringify(payload));
  e.dataTransfer.effectAllowed = "move";
}

// Professional shared mark: standard icons stay; a small slate people badge
// with a "Shared by X" tooltip. No color wash.
export function SharedMark({ ownerName, overlay }: { ownerName?: string; overlay?: boolean }) {
  return (
    <span
      title={ownerName ? `Shared by ${ownerName}` : "Shared with you"}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm",
        overlay ? "absolute bottom-2 right-2 h-6 w-6" : "h-5 w-5"
      )}
    >
      <Users className={overlay ? "h-3.5 w-3.5" : "h-3 w-3"} />
    </span>
  );
}

// Explorer / Drive browser: single click selects, second click opens.
// Folders first, then files. Drag files/folders onto folders to move.
export function DriveGrid({ folders, files, view, canManage, isOwn, sharedBy, onOpenFolder, onOpenFile, onAction, onMove }: {
  folders: DriveFolderItem[];
  files: DriveFile[];
  view: DriveView;
  canManage: boolean;
  isOwn: boolean;
  sharedBy?: string;
  onOpenFolder: (id: string, ownerId?: string | null) => void;
  onOpenFile: (id: string) => void;
  onAction: (kind: GridAction, id: string) => void;
  onMove: (kind: "file" | "folder", id: string, destId: string | null) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  function clickRow(id: string, open: () => void) {
    if (selected === id) open();
    else setSelected(id);
  }

  function dropOn(destId: string) {
    return (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(null);
      const d = readDrag(e);
      if (!d || d.id === destId) return;
      onMove(d.kind, d.id, destId);
    };
  }

  function folderMenu(f: DriveFolderItem): MenuItem[] {
    const items: MenuItem[] = [{ label: "Open", run: () => onOpenFolder(f.id, f.ownerId ?? null) }];
    if (canManage) {
      items.push({ label: "Rename", run: () => onAction("rename-folder", f.id) });
      if (!f.id.startsWith("bank:")) {
        items.push({ label: "Import into…", run: () => onAction("import-folder", f.id) });
        items.push({ label: "Make a copy", run: () => onAction("copy-folder", f.id) });
      }
    }
    if (!f.id.startsWith("bank:")) items.push({ label: "Download (.zip)", run: () => onAction("download-folder", f.id) });
    if (isOwn) {
      items.push({ label: "Share…", run: () => onAction("share-folder", f.id) });
      items.push({ label: "Assigned people", run: () => onAction("assigned-folder", f.id) });
      items.push({ label: f.isPublic ? "Make private" : "Make public", run: () => onAction("publish-folder", f.id) });
      items.push({ label: "Delete", danger: true, run: () => onAction("delete-folder", f.id) });
    }
    return items;
  }

  function fileMenu(qid: string): MenuItem[] {
    const items: MenuItem[] = [
      { label: "Open", run: () => onOpenFile(qid) },
    ];
    if (canManage) {
      items.push({ label: "Edit question", run: () => onAction("edit-file", qid) });
      items.push({ label: "Move to…", run: () => onAction("move-file", qid) });
    }
    items.push({ label: "Download (.json)", run: () => onAction("download-file", qid) });
    if (isOwn) items.push({ label: "Assign someone…", run: () => onAction("assign-file", qid) });
    if (canManage) items.push({ label: "Delete", danger: true, run: () => onAction("delete-file", qid) });
    return items;
  }

  const total = folders.length + files.length;
  const selName = selected
    ? folders.find((f) => f.id === selected)?.name ?? files.find((f) => f.id === selected)?.stem ?? null
    : null;

  if (!total) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
        {view === "details" && <HeaderRow />}
        <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
          <FolderOpen className="h-12 w-12 text-slate-200" strokeWidth={1.25} />
          <div className="text-sm text-slate-500">This folder is empty.</div>
          <div className="text-xs text-slate-400">Drag files here to move them, or use New above.</div>
        </div>
        <StatusBar text="0 items" />
      </div>
    );
  }

  if (view === "tiles") {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft" onClick={() => setMenu(null)}>
        <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4">
          {folders.map((f) => (
            <div
              key={`f-${f.id}`}
              draggable={canManage && !f.shared}
              onDragStart={(e) => startDrag(e, { kind: "folder", id: f.id })}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropTarget(f.id); }}
              onDragLeave={() => setDropTarget((t) => (t === f.id ? null : t))}
              onDrop={dropOn(f.id)}
              onClick={(e) => { e.stopPropagation(); clickRow(f.id, () => onOpenFolder(f.id, f.ownerId ?? null)); }}
              onDoubleClick={() => onOpenFolder(f.id, f.ownerId ?? null)}
              className={cn("group relative cursor-default overflow-hidden rounded-xl border bg-white transition",
                dropTarget === f.id ? "border-indigo-400 ring-2 ring-indigo-300" :
                selected === f.id ? "border-indigo-400 ring-1 ring-indigo-300" : "border-slate-200 hover:shadow-soft")}
            >
              <div className="relative flex h-28 items-center justify-center bg-slate-50">
                <Folder className="h-12 w-12 text-amber-500" fill="#fcd34d" strokeWidth={1.25} />
                {f.shared && <SharedMark ownerName={f.ownerName} overlay />}
              </div>
              <div className="truncate px-3 pt-2 text-center text-[13px] font-medium text-slate-700">{f.name}</div>
              <div className="truncate px-3 pb-2 text-center text-[11px] text-slate-400">{f.shared ? `Folder · ${f.ownerName ?? sharedBy ?? "shared"}` : "Folder"}</div>
              <TileMenu id={f.id} menu={menu} setMenu={setMenu} show={folderMenu(f).length > 1} items={folderMenu(f)} />
            </div>
          ))}
          {files.map((q) => {
            const Icon = fileIcon(q.type);
            return (
              <div
                key={`q-${q.id}`}
                draggable={canManage}
                onDragStart={(e) => startDrag(e, { kind: "file", id: q.id })}
                onClick={(e) => { e.stopPropagation(); clickRow(q.id, () => onOpenFile(q.id)); }}
                onDoubleClick={() => onOpenFile(q.id)}
                className={cn("group relative cursor-default overflow-hidden rounded-xl border bg-white transition",
                  selected === q.id ? "border-indigo-400 ring-1 ring-indigo-300" : "border-slate-200 hover:shadow-soft")}
              >
                <div className="relative flex h-28 items-center justify-center bg-slate-50">
                  <Icon className="h-10 w-10 text-indigo-400" strokeWidth={1.5} />
                  {q.shared && <SharedMark ownerName={sharedBy} overlay />}
                </div>
                <div className="px-3 pb-1 pt-2 text-center">
                  <div className="truncate text-[13px] font-medium text-slate-700">{q.stem}</div>
                  <div className="mt-0.5 truncate text-[11px] capitalize text-slate-400">{typeLabel(q.type)} · {q.difficulty}</div>
                </div>
                <TileMenu id={q.id} menu={menu} setMenu={setMenu} show={fileMenu(q.id).length > 1} items={fileMenu(q.id)} />
              </div>
            );
          })}
        </div>
        <StatusBar text={`${total} item${total === 1 ? "" : "s"}`} sel={selName} />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft" onClick={() => setMenu(null)}>
      <HeaderRow />
      <div>
        {folders.map((f) => (
          <div
            key={`f-${f.id}`}
            draggable={canManage && !f.shared}
            onDragStart={(e) => startDrag(e, { kind: "folder", id: f.id })}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropTarget(f.id); }}
            onDragLeave={() => setDropTarget((t) => (t === f.id ? null : t))}
            onDrop={dropOn(f.id)}
            onClick={(e) => { e.stopPropagation(); clickRow(f.id, () => onOpenFolder(f.id, f.ownerId ?? null)); }}
            onDoubleClick={() => onOpenFolder(f.id, f.ownerId ?? null)}
            className={cn("group relative grid min-h-[44px] cursor-default grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-0 sm:grid-cols-[minmax(0,1fr)_160px_150px_28px]",
              dropTarget === f.id ? "bg-indigo-100 ring-1 ring-inset ring-indigo-300" :
              selected === f.id ? "bg-indigo-50 hover:bg-indigo-50" : "hover:bg-slate-50")}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <Folder className="h-[18px] w-[18px] shrink-0 text-amber-500" fill="#fcd34d" strokeWidth={1.75} />
              <span className="truncate text-slate-800">{f.name}</span>
              {f.shared && <SharedMark ownerName={f.ownerName} />}
            </span>
            <span className="hidden truncate text-[13px] text-slate-500 sm:block">File folder{f.shared ? ` · ${f.ownerName ?? ""}` : ""}</span>
            <span className="hidden truncate text-[13px] text-slate-500 sm:block">{fmtDate(f.createdAt)}</span>
            <RowMenu id={f.id} menu={menu} setMenu={setMenu} selected={selected === f.id} show={folderMenu(f).length > 1} items={folderMenu(f)} />
          </div>
        ))}
        {files.map((q) => {
          const Icon = fileIcon(q.type);
          return (
            <div
              key={`q-${q.id}`}
              draggable={canManage}
              onDragStart={(e) => startDrag(e, { kind: "file", id: q.id })}
              onClick={(e) => { e.stopPropagation(); clickRow(q.id, () => onOpenFile(q.id)); }}
              onDoubleClick={() => onOpenFile(q.id)}
              className={cn("group relative grid min-h-[44px] cursor-default grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-0 sm:grid-cols-[minmax(0,1fr)_160px_150px_28px]", selected === q.id ? "bg-indigo-50 hover:bg-indigo-50" : "hover:bg-slate-50")}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Icon className="h-[18px] w-[18px] shrink-0 text-indigo-500" strokeWidth={1.75} />
                <span className="truncate text-slate-800">{q.stem}</span>
                {q.shared && <SharedMark ownerName={sharedBy} />}
              </span>
              <span className="hidden truncate text-[13px] capitalize text-slate-500 sm:block">{typeLabel(q.type)} question</span>
              <span className="hidden truncate text-[13px] text-slate-500 sm:block">{fmtDate(q.createdAt)}</span>
              <RowMenu id={q.id} menu={menu} setMenu={setMenu} selected={selected === q.id} show={fileMenu(q.id).length > 1} items={fileMenu(q.id)} />
            </div>
          );
        })}
      </div>
      <StatusBar text={`${total} item${total === 1 ? "" : "s"}${folders.length && files.length ? ` · ${folders.length} folder${folders.length === 1 ? "" : "s"}, ${files.length} file${files.length === 1 ? "" : "s"}` : ""}`} sel={selName} />
    </div>
  );
}

function HeaderRow() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:grid-cols-[minmax(0,1fr)_160px_150px_28px]">
      <span>Name</span>
      <span className="hidden sm:block">Type</span>
      <span className="hidden sm:block">Date modified</span>
      <span />
    </div>
  );
}

function StatusBar({ text, sel }: { text: string; sel?: string | null }) {
  return (
    <div className="flex items-center gap-2 border-t border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-500">
      <span className="truncate">{text}</span>
      {sel && <span className="hidden truncate border-l border-slate-200 pl-2 sm:block">“{sel}”</span>}
    </div>
  );
}

function RowMenu({ id, menu, setMenu, selected, show, items }: {
  id: string;
  menu: string | null;
  setMenu: (v: string | null) => void;
  selected: boolean;
  show: boolean;
  items: { label: string; danger?: boolean; run: () => void }[];
}) {
  if (!show && menu !== id) return <span />;
  return (
    <>
      <button
        className={cn("rounded-md p-2 transition hover:bg-slate-200/70 hover:text-slate-700 sm:p-1", menu === id || selected ? "text-slate-500 opacity-100" : "text-slate-300 opacity-0 group-hover:opacity-100")}
        onClick={(e) => { e.stopPropagation(); setMenu(menu === id ? null : id); }}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {menu === id && (
        <div className="absolute right-2 top-9 z-20 grid w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lift" onClick={(e) => e.stopPropagation()}>
          {items.map((it) => (
            <button key={it.label} className={cn("px-3 py-2 text-left text-[13px] hover:bg-slate-50", it.danger && "text-red-600 hover:bg-red-50")} onClick={() => { setMenu(null); it.run(); }}>{it.label}</button>
          ))}
        </div>
      )}
    </>
  );
}

function TileMenu({ id, menu, setMenu, show, items }: {
  id: string;
  menu: string | null;
  setMenu: (v: string | null) => void;
  show: boolean;
  items: { label: string; danger?: boolean; run: () => void }[];
}) {
  if (!show) return null;
  return (
    <>
      <button
        className={cn("absolute right-2 top-2 rounded-md p-2 transition hover:bg-slate-100 hover:text-slate-700 sm:p-1.5", menu === id ? "text-slate-500 opacity-100" : "text-slate-300 opacity-0 group-hover:opacity-100")}
        onClick={(e) => { e.stopPropagation(); setMenu(menu === id ? null : id); }}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {menu === id && (
        <div className="absolute right-2 top-10 z-20 grid w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lift" onClick={(e) => e.stopPropagation()}>
          {items.map((it) => (
            <button key={it.label} className={cn("px-3 py-2 text-left text-[13px] hover:bg-slate-50", it.danger && "text-red-600 hover:bg-red-50")} onClick={() => { setMenu(null); it.run(); }}>{it.label}</button>
          ))}
        </div>
      )}
    </>
  );
}
