import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

export type QType = "mcq" | "multi_select" | "true_false" | "fill_in" | "essay" | "short_answer";

export interface QForm {
  type: QType;
  stem: string;
  options: string[];
  correct: string[];
  explanation: string;
  difficulty: string;
  topicId: string;
}

export function styleOf(type: string): "objective" | "theory" | "fill" {
  if (type === "essay" || type === "short_answer") return "theory";
  if (type === "fill_in") return "fill";
  return "objective";
}

const TYPES: Record<string, QType[]> = {
  objective: ["mcq", "multi_select", "true_false"],
  theory: ["essay", "short_answer"],
  fill: ["fill_in"]
};

export function countGaps(stem: string): number {
  return stem.split("___").length - 1;
}

export function validateForm(f: QForm): string[] {
  const errs: string[] = [];
  if (f.stem.trim().length < 8) errs.push("Stem needs 8+ characters.");
  if (f.type === "mcq") {
    if (f.options.filter((o) => o.trim()).length < 2) errs.push("MCQ needs at least 2 options.");
    if (f.correct.length !== 1) errs.push("MCQ needs exactly one correct answer.");
  }
  if (f.type === "multi_select") {
    if (f.options.filter((o) => o.trim()).length < 2) errs.push("Multi-select needs at least 2 options.");
    if (!f.correct.length) errs.push("Mark at least one correct option.");
  }
  if (f.type === "true_false" && f.correct.length !== 1) errs.push("Pick True or False as correct.");
  if (f.type === "fill_in") {
    if (countGaps(f.stem) < 1) errs.push("Fill-in needs at least one ___ gap in the stem.");
    if (f.correct.some((c) => !c.trim())) errs.push("Every gap needs an answer.");
  }
  if ((f.type === "essay" || f.type === "short_answer") && f.explanation.trim().length < 10) errs.push("Theory needs a marking guide (10+ chars).");
  else if (f.type !== "essay" && f.type !== "short_answer" && f.explanation.trim().length < 4) errs.push("Explanation is required before review.");
  return errs;
}

export function QuestionEditor({ initial, topics, submitLabel, onSubmit }: {
  initial?: Partial<QForm>;
  topics: { id: string; name: string; subject: string; exam: string }[];
  submitLabel: string;
  onSubmit: (f: QForm) => void;
}) {
  const [type, setType] = useState<QType>((initial?.type as QType) ?? "mcq");
  const [stem, setStem] = useState(initial?.stem ?? "");
  const [options, setOptions] = useState<string[]>(initial?.options ?? ["", "", "", ""]);
  const [correct, setCorrect] = useState<string[]>(initial?.correct ?? []);
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? "medium");
  const [topicId, setTopicId] = useState(initial?.topicId ?? "");
  const stemRef = useRef<HTMLTextAreaElement>(null);
  const style = styleOf(type);
  const gaps = useMemo(() => countGaps(stem), [stem]);
  const errors = validateForm({ type, stem, options, correct, explanation, difficulty, topicId });

  function setStyle(s: "objective" | "theory" | "fill") {
    const t = TYPES[s][0];
    setType(t);
    if (s === "theory") { setOptions([]); setCorrect([]); }
    if (s === "fill") {
      setOptions([]);
      setCorrect((c) => {
        const n = countGaps(stem);
        const next = [...c];
        while (next.length < n) next.push("");
        return next.slice(0, Math.max(n, 1));
      });
    }
    if (s === "objective" && !options.length) { setOptions(["", "", "", ""]); setCorrect([]); }
  }

  function insertGap() {
    const el = stemRef.current;
    const marker = " ___ ";
    if (!el) { setStem((s) => s + marker); return; }
    const { selectionStart, selectionEnd, value } = el;
    const next = value.slice(0, selectionStart) + marker + value.slice(selectionEnd);
    setStem(next);
    setCorrect((c) => [...c, ""]);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = selectionStart + marker.length; });
  }

  function setGapAnswer(i: number, v: string) {
    setCorrect((c) => { const n = [...c]; n[i] = v; return n; });
  }

  // keep correct array in sync with gap count
  function syncedCorrect(): string[] {
    if (style !== "fill") return correct;
    const n = Math.max(gaps, 1);
    const next = [...correct];
    while (next.length < n) next.push("");
    return next.slice(0, n);
  }

  function toggleCorrect(o: string) {
    if (type === "multi_select") {
      setCorrect((c) => (c.includes(o) && o ? c.filter((x) => x !== o) : [...c, o]));
    } else {
      setCorrect(o ? [o] : []);
    }
  }

  function submit() {
    onSubmit({ type, stem, options: style === "objective" ? options.map((o) => o.trim()).filter(Boolean) : [], correct: style === "fill" ? syncedCorrect().map((s) => s.trim()) : correct, explanation, difficulty, topicId });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card><CardHeader><CardTitle>Compose</CardTitle><CardDescription>Drafts save anytime.</CardDescription></CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            {(["objective", "theory", "fill"] as const).map((s) => (
              <Button key={s} size="sm" variant={style === s ? "default" : "outline"} onClick={() => setStyle(s)}>
                {s === "objective" ? "Objective" : s === "theory" ? "Theory" : "Fill gaps"}
              </Button>
            ))}
            <Select className="w-auto" value={type} onChange={(e) => { const t = e.target.value as QType; setType(t); if (t === "true_false") setOptions(["True", "False"]); }}>
              {TYPES[style].map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
            </Select>
            <Select className="w-auto" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
            </Select>
          </div>

          <label className="yrk-label">Question stem
            <Textarea ref={stemRef} placeholder={style === "fill" ? "e.g. Cardiac output = ___ × ___." : style === "theory" ? "e.g. Explain why passengers lurch forward when a bus brakes." : "e.g. A car accelerates from 0 to 20 m/s in 5 s. Acceleration?"} value={stem} onChange={(e) => setStem(e.target.value)} />
          </label>
          {style === "fill" && (
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <Button size="sm" variant="secondary" onClick={insertGap}><Plus className="h-3.5 w-3.5" /> Insert gap ___</Button>
              <span className="text-slate-500">{gaps} gap{gaps === 1 ? "" : "s"} detected</span>
            </div>
          )}

          {style === "objective" && type !== "true_false" && (
            <div className="grid gap-2">
              <span className="yrk-label">Options, tick the correct {type === "multi_select" ? "(several)" : "(one)"}</span>
              {options.map((o, i) => (
                <div key={i} className="flex min-w-0 items-center gap-2">
                  <button onClick={() => toggleCorrect(o)} title="Mark correct"
                    className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition", o && correct.includes(o) ? "border-emerald-600 bg-emerald-500 text-white" : "border-slate-300 text-transparent hover:border-emerald-500")}>✓</button>
                  <Input placeholder={`Option ${i + 1}`} value={o} onChange={(e) => {
                    const next = [...options]; next[i] = e.target.value;
                    const old = options[i];
                    setOptions(next);
                    setCorrect((c) => c.map((x) => (x === old ? e.target.value : x)));
                  }} />
                  {options.length > 2 && <Button size="icon" variant="ghost" onClick={() => { setOptions(options.filter((_, j) => j !== i)); setCorrect(correct.filter((x) => x !== o)); }}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              ))}
              <Button size="sm" variant="outline" className="w-fit" onClick={() => setOptions([...options, ""])}><Plus className="h-3.5 w-3.5" /> Add option</Button>
            </div>
          )}
          {style === "objective" && type === "true_false" && (
            <div className="flex gap-2">
              {["True", "False"].map((o) => (
                <Button key={o} variant={correct.includes(o) ? "default" : "outline"} onClick={() => setCorrect([o])}>{o}</Button>
              ))}
            </div>
          )}
          {style === "fill" && (
            <div className="grid gap-2 rounded-xl bg-slate-50 p-3">
              <span className="yrk-label">Answers, one per gap, in order</span>
              {syncedCorrect().map((a, i) => (
                <label key={i} className="yrk-label flex items-center gap-2">Gap {i + 1}<Input placeholder={`Answer for gap ${i + 1}`} value={a} onChange={(e) => setGapAnswer(i, e.target.value)} /></label>
              ))}
              {gaps < 1 && <span className="yrk-hint">Add a ___ in the stem above to create gaps.</span>}
            </div>
          )}

          <label className="yrk-label">{style === "theory" ? "Marking guide / model answer (required)" : "Explanation / rationale (required)"}
            <Textarea placeholder={style === "theory" ? "What earns full marks? Key points…" : "Why is the answer right?"} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
          </label>
          <label className="yrk-label">File under Subject → Topic
            <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              <option value="">No topic yet (general)</option>
              {topics.map((t) => <option key={t.id} value={t.id}>{t.exam} › {t.subject} › {t.name}</option>)}
            </Select>
          </label>
          {!!errors.length && <div className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-800">{errors.join(" ")}</div>}
          <Button variant="accent" onClick={submit}>{submitLabel}</Button>
        </CardContent>
      </Card>

      <Card className="h-fit lg:sticky lg:top-20"><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Eye className="h-4 w-4 text-indigo-600" /> Learner preview</CardTitle><CardDescription>Exactly how it reads in a quiz.</CardDescription></CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div className="font-medium leading-snug break-words">{stem || <span className="text-slate-400">Stem appears here…</span>}</div>
          {style === "objective" && options.filter((o) => o.trim()).map((o) => (
            <div key={o} className={cn("rounded-lg border px-3 py-2", correct.includes(o) ? "border-emerald-300 bg-emerald-50" : "border-slate-200")}>{o}</div>
          ))}
          {style === "fill" && <div className="text-slate-500">{gaps} blank{gaps === 1 ? "" : "s"} · answers: {syncedCorrect().filter(Boolean).join(" · ") || "none yet"}</div>}
          {style === "theory" && <div className="rounded-lg bg-slate-50 p-2 text-[13px] text-slate-500">Written answer · guide: {explanation.slice(0, 80) || "none yet"}</div>}
          <div className="flex gap-1.5"><Badge tone="draft">{type.replace("_", " ")}</Badge><Badge tone={difficulty}>{difficulty}</Badge></div>
        </CardContent>
      </Card>
    </div>
  );
}
