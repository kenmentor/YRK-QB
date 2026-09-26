"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { Plus, X, FileStack, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

const CATS: [string, string][] = [["primary", "Primary"], ["secondary", "Secondary"], ["tertiary", "Tertiary"], ["professional", "Professional"], ["other", "Other"]];

// One shared entry to creating an activity, used by Archive and Play.
export function NewActivityButton({ variant, size, label }: {
  variant?: "accent" | "default" | "outline" | "secondary" | "ghost";
  size?: "sm" | "default" | "lg" | "icon";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("tertiary");
  const [sector, setSector] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle(""); setCategory("tertiary"); setSector(""); setVisibility("private"); setBusy(false);
      const t = setTimeout(() => titleRef.current?.focus(), 60);
      const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
      window.addEventListener("keydown", esc);
      return () => { clearTimeout(t); window.removeEventListener("keydown", esc); };
    }
  }, [open ]);

  async function create() {
    if (!title.trim()) { toast("Give the activity a title."); titleRef.current?.focus(); return; }
    setBusy(true);
    const res = await fetch("/api/activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, category, sector, visibility }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { toast(d.error ?? "Couldn't create"); return; }
    window.location.href = `/activities/${d.id}`;
  }

  return (
    <>
      <Button variant={variant ?? "accent"} size={size ?? "default"} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> {label ?? "New activity"}
      </Button>
      {open && (
        <div className="yrk-sheet fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-900/55 p-4 backdrop-blur-[2px]" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-lift" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50"><FileStack className="h-5 w-5 text-indigo-600" /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold">New activity</div>
                <div className="truncate text-[13px] text-slate-400">Content, rules and publishing happen in the builder.</div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3.5 p-5">
              <label className="yrk-label">Title
                <Input ref={titleRef as React.RefObject<HTMLInputElement>} placeholder="e.g. WAEC Physics Mock 1" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
              </label>
              <div className="grid gap-1.5">
                <span className="yrk-label">Category</span>
                <div className="flex flex-wrap gap-1.5">
                  {CATS.map(([v, l]) => (
                    <button key={v} onClick={() => setCategory(v)}
                      className={cn("rounded-full px-3 py-1.5 text-[13px] font-semibold transition", category === v ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:text-slate-800")}>{l}</button>
                  ))}
                </div>
              </div>
              <label className="yrk-label">Sector <span className="font-normal text-slate-400">(optional)</span>
                <Input placeholder="e.g. Medicine" value={sector} onChange={(e) => setSector(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["private", "public"] as const).map((v) => (
                  <button key={v} onClick={() => setVisibility(v)}
                    className={cn("flex items-center gap-2 rounded-2xl border p-3 text-left transition", visibility === v ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 hover:border-slate-400")}>
                    {v === "private" ? <EyeOff className="h-4 w-4 shrink-0" /> : <Eye className="h-4 w-4 shrink-0" />}
                    <span><span className="block text-[13px] font-bold capitalize">{v}</span>
                    <span className={cn("block text-[11px]", visibility === v ? "text-white/70" : "text-slate-400")}>{v === "private" ? "Only you + added people" : "Archive + every player"}</span></span>
                  </button>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button variant="accent" onClick={create} disabled={busy}>{busy ? "Creating…" : "Open builder"}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
