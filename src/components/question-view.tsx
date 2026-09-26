import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, X, Paperclip } from "lucide-react";
import { fileIcon } from "./drive-grid";
import { TYPE_LABEL, styleOf } from "./question-editor";

export interface ViewPart { stem?: string; label?: string; max?: number; }

export interface ViewQuestion {
  id: string;
  stem: string;
  options: string;
  correct: string;
  parts?: string;
  explanation: string;
  difficulty: string;
  difficultyIndex?: number;
  category?: string;
  sector?: string;
  tags?: string;
  mediaUrl?: string;
  type: string;
}

function js<T>(raw: string | undefined, fb: T): T {
  try { return raw ? (JSON.parse(raw) as T) : fb; } catch { return fb; }
}

// Renders any catalog type the way a learner sees it.
// The Edit entry is a small ghost button, top-right — Drive-style.
export function QuestionView({ q, canEdit, onEdit, onClose }: {
  q: ViewQuestion;
  canEdit: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const Icon = fileIcon(q.type);
  const opts = js<string[]>(q.options, []);
  const correct = js<string[]>(q.correct, []);
  const parts = js<ViewPart[]>(q.parts, []);
  const tags = js<string[]>(q.tags, []);
  const rubricTotal = parts.reduce((s, p) => s + (Number(p.max) || 0), 0);

  function renderBody() {
    if (q.type === "fill_in") {
      const segs = (q.stem ?? "").split("___");
      return (
        <p className="text-[15px] leading-relaxed text-slate-800">
          {segs.map((p, i) => (
            <span key={i}>{p}{i < segs.length - 1 && (
              <span className="mx-1 inline-block min-w-20 rounded-md border-b-2 border-indigo-300 bg-indigo-50 px-2 py-0.5 text-center text-sm font-semibold text-indigo-700">{correct[i] || "…"}</span>
            )}</span>
          ))}
        </p>
      );
    }
    if (q.type === "mtf") {
      return (
        <div className="grid gap-2">
          {parts.map((p, i) => (
            <div key={i} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm">
              <span className="min-w-0">{p.stem}</span>
              <Badge tone={correct[i] === "True" ? "approved" : "closed"}>{correct[i] ?? "—"}</Badge>
            </div>
          ))}
        </div>
      );
    }
    if (q.type === "saq") {
      return <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Accepts any of: <span className="font-semibold text-slate-800">{correct.join(" / ") || "—"}</span></div>;
    }
    if (q.type === "sct") {
      return (
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-1.5">
            {["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"].map((s) => (
              <span key={s} className={`rounded-lg border px-2.5 py-1.5 text-[13px] ${correct[0] === s ? "border-emerald-400 bg-emerald-50 font-semibold text-emerald-800" : "border-slate-200 text-slate-500"}`}>{s}</span>
            ))}
          </div>
          <div className="text-[13px] text-slate-500">Expert panel: <span className="font-semibold text-slate-700">{correct[0]}</span></div>
        </div>
      );
    }
    if (["emq", "matching", "kfq", "meq", "compound"].includes(q.type)) {
      const shared = ["emq", "matching"].includes(q.type);
      return (
        <div className="grid gap-2">
          {shared && <div className="text-[13px] text-slate-500">Shared options: {opts.join(" · ")}</div>}
          {parts.map((p, i) => (
            <div key={i} className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm">
              <div className="font-medium">{i + 1}. {p.stem}</div>
              <div className="mt-1 text-emerald-800">→ {(correct[i] ?? "").split("||").join(" / ") || "—"}</div>
            </div>
          ))}
        </div>
      );
    }
    if (styleOf(q.type) === "rubric") {
      return (
        <div className="grid gap-2">
          {parts.map((p, i) => (
            <div key={i} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm">
              <span className="min-w-0">{p.label}</span>
              <span className="shrink-0 font-semibold text-slate-600">{p.max} mark{(p.max ?? 0) === 1 ? "" : "s"}</span>
            </div>
          ))}
          <div className="text-right text-[13px] font-semibold text-slate-600">Total {rubricTotal} marks</div>
        </div>
      );
    }
    if (q.type === "essay" || q.type === "short_answer") {
      return <div className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">Written answer — marking guide below.</div>;
    }
    return (
      <div className="grid gap-2">
        {opts.map((o) => {
          const isRight = correct.includes(o);
          return (
            <div key={o} className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm ${isRight ? "border-emerald-300 bg-emerald-50 font-medium text-emerald-900" : "border-slate-200 text-slate-700"}`}>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${isRight ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent"}`}>✓</span>
              {o}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="yrk-sheet fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-slate-900/50 p-3 sm:p-6" onClick={onClose}>
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-lift" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50"><Icon className="h-4.5 w-4.5 text-indigo-600" /></span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{(TYPE_LABEL as Record<string, string>)[q.type ?? ""] ?? q.type ?? "Question"} · {q.difficultyIndex ? `${q.difficultyIndex}/5 · ` : ""}{q.difficulty}</div>
          </div>
          {canEdit && (
            <Button size="sm" variant="ghost" onClick={onEdit} title="Edit question" className="text-slate-500 hover:text-indigo-700">
              <Pencil className="h-3.5 w-3.5" /> Edit question
            </Button>
          )}
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid max-h-[70vh] gap-4 overflow-y-auto p-5 sm:p-6">
          <h2 className="text-lg font-semibold leading-snug text-slate-900">{q.stem}</h2>
          {renderBody()}
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Answer & guide</div>
            {!["essay", "short_answer"].includes(q.type) && styleOf(q.type) !== "rubric" && (
              <div className="mt-1.5"><Badge tone="approved">Answer: {["kfq", "meq", "compound"].includes(q.type) ? correct.map((c) => c.split("||").join(" / ")).join(" · ") : correct.join(", ") || "see guide"}</Badge></div>
            )}
            {styleOf(q.type) === "rubric" && <div className="mt-1.5"><Badge tone="approved">{rubricTotal} marks available</Badge></div>}
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{q.explanation}</p>
            {(q.category || q.sector || tags.length > 0 || q.mediaUrl) && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {q.category && <Badge>{q.category}</Badge>}
                {q.sector && <Badge>{q.sector}</Badge>}
                {tags.map((t) => <Badge key={t}>{t}</Badge>)}
                {q.mediaUrl && <a href={q.mediaUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[13px] font-medium text-indigo-600 hover:underline"><Paperclip className="h-3.5 w-3.5" /> Media file</a>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
