"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { X, Upload, FileJson, CheckCircle2, XCircle, Download } from "lucide-react";
import { parseImportFile, countBundle, downloadBlob, SAMPLE_BUNDLE, type ParsedImport } from "@/lib/transport";
import { cn } from "@/lib/utils";

// Import a real folder: pick .zip/.json (or hand-written JSON), preview
// counts + faults, confirm posts the validated bundle. Scope = destination
// folder (null = own root).
export function ImportModal({ scopeName, parentId, onDone, onClose }: {
  scopeName: string;
  parentId: string | null;
  onDone: () => void;
  onClose: () => void;
}) {
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    try {
      setParsed(await parseImportFile(file));
    } catch {
      toast("Couldn't read that file.");
    }
  }

  function shapeErrors(): string[] {
    if (!parsed) return [];
    const errs = [...parsed.errors];
    const { folders, questions } = countBundle(parsed.bundle);
    if (folders > 100) errs.push("Too many folders (max 100)");
    if (questions > 500) errs.push("Too many questions (max 500)");
    return errs;
  }

  async function confirm() {
    if (!parsed || busy) return;
    setBusy(true);
    const res = await fetch("/api/drive/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parentId, bundle: parsed.bundle }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast(d.error ?? "Import failed");
      if (d.issues) toast(d.issues.slice(0, 3).join(" · "));
      return;
    }
    toast(`Imported ${d.questions} questions into “${parsed.bundle.name}”.`);
    onDone();
  }

  const errs = shapeErrors();
  const counts = parsed ? countBundle(parsed.bundle) : null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="grid max-h-[90dvh] w-full max-w-md gap-3 overflow-y-auto rounded-3xl bg-white p-5 shadow-lift" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-bold">Import into “{scopeName}”</div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="text-[13px] leading-relaxed text-slate-500">
          Drop a <span className="font-semibold">.zip real folder</span> or a <span className="font-semibold">.json</span> (bundle or single question, incl. hand-written). Format is validated before anything is created.
        </div>
        <label className="grid cursor-pointer place-items-center gap-1.5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:border-indigo-400 hover:bg-indigo-50/40">
          <Upload className="h-6 w-6 text-slate-400" />
          <span className="text-sm font-semibold text-slate-600">Pick a .zip or .json file</span>
          <Input type="file" accept=".zip,.json" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        <button className="flex items-center justify-center gap-1.5 text-[13px] font-medium text-indigo-600 hover:underline"
          onClick={() => downloadBlob("sample-bank.json", JSON.stringify(SAMPLE_BUNDLE, null, 2), "application/json")}>
          <Download className="h-3.5 w-3.5" /> Download a sample JSON to copy the format
        </button>
        {parsed && (
          <div className="grid gap-2 rounded-2xl border border-slate-100 p-3">
            <div className="flex items-center gap-2 text-sm">
              <FileJson className="h-4 w-4 text-indigo-500" />
              <span className="min-w-0 flex-1 truncate font-semibold">{parsed.bundle.name}</span>
              <span className="shrink-0 text-[13px] text-slate-500">{counts?.folders} folders · {counts?.questions} questions</span>
            </div>
            {errs.length ? (
              <div className="grid gap-1">
                {errs.slice(0, 6).map((e, i) => (
                  <div key={i} className="flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-[13px] text-red-800">
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{e}
                  </div>
                ))}
                <div className="text-xs text-slate-400">Fix the file and pick it again — nothing imports with faults.</div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[13px] font-medium text-emerald-800">
                <CheckCircle2 className="h-4 w-4" /> Shape looks good — server re-validates every question.
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="accent" disabled={!parsed || !!errs.length || busy} onClick={confirm} className={cn(!parsed || !!errs.length || busy ? "opacity-50" : "")}>
            {busy ? "Importing…" : "Confirm import"}
          </Button>
        </div>
      </div>
    </div>
  );
}
