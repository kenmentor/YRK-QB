import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { readDrag } from "./drive-grid";

export interface DriveFolder {
  id: string;
  name: string;
  parentId?: string | null;
  ownerId?: string | null;
}

export function DriveTree({ folders, currentId, counts, onSelect, onDropMove }: {
  folders: DriveFolder[];
  currentId: string | null;
  counts?: Record<string, number>;
  onSelect: (id: string | null, ownerId?: string | null) => void;
  onDropMove?: (kind: "file" | "folder", id: string, destId: string | null) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [dropId, setDropId] = useState<string | null>(null);

  function dropProps(destId: string | null, selfId?: string) {
    if (!onDropMove) return {};
    const key = destId ?? "__root__";
    return {
      onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDropId(key); },
      onDragLeave: () => setDropId((t) => (t === key ? null : t)),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDropId(null);
        const d = readDrag(e);
        if (!d || d.id === selfId) return;
        onDropMove(d.kind, d.id, destId);
      },
    };
  }
  const kids = useMemo(() => {
    const m = new Map<string | null, DriveFolder[]>();
    for (const f of folders) {
      const k = (f.parentId ?? null) as string | null;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(f);
    }
    return m;
  }, [folders]);

  function toggle(id: string) {
    setOpen((o) => ({ ...o, [id]: o[id] === false ? true : o[id] ? false : true }));
  }

  function renderLevel(parent: string | null, depth: number): React.ReactNode {
    return (kids.get(parent) ?? []).map((f) => {
      const hasKids = (kids.get(f.id) ?? []).length > 0;
      const expanded = open[f.id] !== false;
      const active = currentId === f.id;
      return (
        <div key={f.id}>
          <div className="flex items-center gap-0.5">
            {hasKids ? (
              <button onClick={() => toggle(f.id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 sm:h-6 sm:w-6" title={expanded ? "Collapse" : "Expand"}>
                {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : <span className="w-6 shrink-0" />}
            <button
              onClick={() => onSelect(f.id, f.ownerId ?? null)}
              className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition sm:py-1.5 sm:text-[13px]", active ? "bg-indigo-50 font-semibold text-indigo-700" : dropId === f.id ? "bg-indigo-100 ring-1 ring-indigo-300" : "text-slate-600 hover:bg-slate-100")}
              style={{ paddingLeft: `${8 + depth * 2}px` }}
              {...dropProps(f.id, f.id)}
            >
              {active ? <FolderOpen className="h-4 w-4 shrink-0 text-indigo-500" /> : <Folder className="h-4 w-4 shrink-0 text-slate-400" />}
              <span className="truncate">{f.name}</span>
              {!!counts?.[f.id] && <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-500">{counts[f.id]}</span>}
            </button>
          </div>
          {hasKids && expanded && <div>{renderLevel(f.id, depth + 1)}</div>}
        </div>
      );
    });
  }

  return (
    <div className="grid gap-0.5">
      <button
        onClick={() => onSelect(null)}
        className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition", currentId === null ? "bg-indigo-50 font-semibold text-indigo-700" : dropId === "__root__" ? "bg-indigo-100 ring-1 ring-indigo-300" : "text-slate-600 hover:bg-slate-100")}
        {...dropProps(null)}
      >
        <Database className="ml-6 h-4 w-4 shrink-0 text-indigo-500" />
        <span className="truncate">My Bank</span>
      </button>
      {renderLevel(null, 0)}
    </div>
  );
}
