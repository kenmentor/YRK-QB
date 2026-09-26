import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Eye, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type QType =
  | "mcq" | "multi_select" | "true_false" | "mtf" | "sct"
  | "fill_in" | "saq" | "short_answer" | "essay" | "compound" | "meq"
  | "matching" | "emq" | "kfq"
  | "osce" | "dops" | "minicex" | "msf" | "viva";

export type QStyle = "objective" | "written" | "matching" | "rubric";

export interface QPart { stem?: string; label?: string; max?: number; }

export interface QForm {
  type: QType;
  stem: string;
  options: string[];
  correct: string[];
  parts: QPart[];
  explanation: string;
  difficultyIndex: number;
  difficulty: string;
  category: string;
  sector: string;
  tags: string[];
  mediaUrl: string;
  topicId: string;
}

export const TYPE_LABEL: Record<QType, string> = {
  mcq: "MCQ / Best option (SBA)",
  multi_select: "Multi-select",
  true_false: "True or False",
  mtf: "Multiple True/False (MTF)",
  sct: "Script Concordance (SCT)",
  fill_in: "Fill-in-the-Blank",
  saq: "Short Answer (SAQ)",
  short_answer: "Short answer (legacy)",
  essay: "Descriptive / Extended Essay (LEQ)",
  compound: "Compound Question",
  meq: "Modified Essay (MEQ)",
  matching: "Drag-and-Drop / Matching",
  emq: "Extended Matching (EMQ)",
  kfq: "Key Feature (KFQ)",
  osce: "OSCE / OSPE Rubric",
  dops: "DOPS Checklist",
  minicex: "Mini-CEX Logbook",
  msf: "Multi-Source Feedback (MSF)",
  viva: "Viva / Oral (SOE)",
};

const GROUPS: Record<QStyle, { label: string; types: QType[] }> = {
  objective: { label: "Objective", types: ["mcq", "multi_select", "true_false", "mtf", "sct"] },
  written: { label: "Written", types: ["fill_in", "saq", "short_answer", "essay", "compound", "meq"] },
  matching: { label: "Matching", types: ["matching", "emq", "kfq"] },
  rubric: { label: "Clinical rubric", types: ["osce", "dops", "minicex", "msf", "viva"] },
};

export const SCT_SCALE = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];

export function styleOf(type: string): QStyle {
  if (["osce", "dops", "minicex", "msf", "viva"].includes(type)) return "rubric";
  if (["matching", "emq", "kfq"].includes(type)) return "matching";
  if (["mcq", "multi_select", "true_false", "mtf", "sct"].includes(type)) return "objective";
  return "written";
}

export function bandOf(i: number): string {
  return i <= 2 ? "easy" : i >= 4 ? "hard" : "medium";
}

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
  if (f.type === "mtf") {
    if (f.parts.length < 2) errs.push("MTF needs at least 2 statements.");
    if (f.parts.some((p) => !(p.stem ?? "").trim())) errs.push("Every MTF statement needs text.");
  }
  if (f.type === "sct" && f.correct.length !== 1) errs.push("Pick the expert panel choice.");
  if (f.type === "fill_in") {
    if (countGaps(f.stem) < 1) errs.push("Fill-in needs at least one ___ gap in the stem.");
    if (f.correct.some((c) => !c.trim())) errs.push("Every gap needs an answer.");
  }
  if (f.type === "saq" && !f.correct.some((c) => c.trim())) errs.push("SAQ needs at least one accepted answer.");
  if ((f.type === "emq" || f.type === "matching")) {
    if (!f.parts.length) errs.push("Needs at least 1 sub-question.");
    if (f.options.filter((o) => o.trim()).length < 2) errs.push("Needs a shared option list of at least 2.");
    if (f.correct.some((c) => !c.trim())) errs.push("Every sub-question needs a match.");
  }
  if (f.type === "kfq" || f.type === "meq" || f.type === "compound") {
    if (!f.parts.length) errs.push("Needs at least 1 key question.");
    if (f.parts.some((p) => !(p.stem ?? "").trim())) errs.push("Every key question needs text.");
    if (f.correct.some((c) => !c.trim())) errs.push("Every key question needs an expected answer (use || for alternatives).");
  }
  if (["osce", "dops", "minicex", "msf", "viva"].includes(f.type)) {
    if (!f.parts.length) errs.push("Rubric needs at least 1 criterion.");
    if (f.parts.some((p) => !(p.label ?? "").trim())) errs.push("Every criterion needs a label.");
    if (f.parts.some((p) => !(p.max ?? 0))) errs.push("Every criterion needs marks above zero.");
  }
  if ((f.type === "essay" || f.type === "short_answer" || f.type === "saq") && f.explanation.trim().length < 10) errs.push("Written answers need a marking guide (10+ chars).");
  else if (!["essay", "short_answer", "saq"].includes(f.type) && f.explanation.trim().length < 4) errs.push("Explanation is required before review.");
  return errs;
}

function blankParts(n: number): QPart[] {
  return Array.from({ length: n }, () => ({ stem: "" }));
}

export function QuestionEditor({ initial, topics, submitLabel, onSubmit, strict }: {
  initial?: Partial<QForm>;
  topics: { id: string; name: string; subject: string; exam: string }[];
  submitLabel: string;
  onSubmit: (f: QForm) => void;
  strict?: boolean;
}) {
  const [type, setType] = useState<QType>((initial?.type as QType) ?? "mcq");
  const [stem, setStem] = useState(initial?.stem ?? "");
  const [options, setOptions] = useState<string[]>(initial?.options ?? ["", "", "", ""]);
  const [correct, setCorrect] = useState<string[]>(initial?.correct ?? []);
  const [parts, setParts] = useState<QPart[]>(initial?.parts ?? []);
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [difficultyIndex, setDifficultyIndex] = useState(initial?.difficultyIndex ?? 3);
  const [category, setCategory] = useState(initial?.category ?? "tertiary");
  const [sector, setSector] = useState(initial?.sector ?? "");
  const [tagsStr, setTagsStr] = useState((initial?.tags ?? []).join(", "));
  const [mediaUrl, setMediaUrl] = useState(initial?.mediaUrl ?? "");
  const [topicId, setTopicId] = useState(initial?.topicId ?? "");
  // Mobile shows Compose xor Preview (slide between them); desktop shows both.
  const [mobilePane, setMobilePane] = useState<"compose" | "preview">("compose");
  // Profile stays collapsed unless the question already carries metadata.
  const [profileOpen, setProfileOpen] = useState(
    !!(initial?.sector || (initial?.tags ?? []).length || initial?.mediaUrl || initial?.topicId || (initial?.category && initial.category !== "tertiary"))
  );
  const stemRef = useRef<HTMLTextAreaElement>(null);
  const style = styleOf(type);
  const gaps = useMemo(() => countGaps(stem), [stem]);
  const form: QForm = {
    type, stem, options, correct, parts, explanation,
    difficultyIndex, difficulty: bandOf(difficultyIndex),
    category, sector, tags: tagsStr.split(",").map((t) => t.trim()).filter(Boolean),
    mediaUrl, topicId,
  };
  const errors = validateForm(form);

  function applyType(t: QType) {
    setType(t);
    if (t === "true_false") { setOptions(["True", "False"]); setCorrect((c) => (c.length ? c : ["True"])); setParts([]); }
    else if (t === "sct") { setOptions([...SCT_SCALE]); setCorrect((c) => (c.length ? c.slice(0, 1) : [])); setParts([]); }
    else if (t === "mtf") { setOptions([]); setParts((p) => (p.length >= 2 ? p : blankParts(2))); setCorrect((c) => { const n = Math.max(2, parts.length); const next = [...c]; while (next.length < n) next.push("True"); return next.slice(0, n); }); }
    else if (t === "emq" || t === "matching") {
      setParts((p) => (p.length ? p : blankParts(1)));
      setOptions((o) => (o.length >= 2 ? o : ["", "", "", ""]));
      setCorrect((c) => (c.length ? c : [""]));
    }
    else if (t === "kfq" || t === "meq" || t === "compound") {
      setOptions([]); setParts((p) => (p.length ? p : blankParts(1))); setCorrect((c) => (c.length ? c : [""]));
    }
    else if (["osce", "dops", "minicex", "msf", "viva"].includes(t)) {
      setOptions([]); setCorrect([]); setParts((p) => (p.length ? p : [{ label: "", max: 5 }]));
    }
    else if (t === "fill_in") { setOptions([]); setCorrect((c) => (c.length ? c : [""])); setParts([]); }
    else if (t === "saq") { setOptions([]); setParts([]); setCorrect((c) => (c.length ? c : [""])); }
    else if (t === "essay" || t === "short_answer") { setOptions([]); setCorrect([]); setParts([]); }
    else { setOptions((o) => (o.length ? o : ["", "", "", ""])); setCorrect([]); setParts([]); }
  }

  function setPart(i: number, patch: Partial<QPart>) {
    setParts((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }

  function addPart() {
    const isRubric = ["osce", "dops", "minicex", "msf", "viva"].includes(type);
    setParts([...parts, isRubric ? { label: "", max: 5 } : { stem: "" }]);
    setCorrect((c) => [...c, isRubric ? "" : "True"]);
  }

  function removePart(i: number) {
    setParts(parts.filter((_, j) => j !== i));
    setCorrect(correct.filter((_, j) => j !== i));
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

  function syncedCorrect(): string[] {
    if (type !== "fill_in") return correct;
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
    if (strict && errors.length) return; // invalid files never reach the bank
    const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
    onSubmit({
      type, stem,
      options: ["mcq", "multi_select", "emq", "matching"].includes(type) ? options.map((o) => o.trim()).filter(Boolean) : type === "true_false" ? ["True", "False"] : type === "sct" ? [...SCT_SCALE] : [],
      correct: type === "fill_in" ? syncedCorrect().map((s) => s.trim()) : type === "saq" ? correct.map((s) => s.trim()).filter(Boolean) : correct,
      parts: ["mtf", "emq", "matching", "kfq", "meq", "compound", "osce", "dops", "minicex", "msf", "viva"].includes(type) ? parts : [],
      explanation, difficultyIndex, difficulty: bandOf(difficultyIndex),
      category, sector: sector.trim(), tags, mediaUrl: mediaUrl.trim(), topicId,
    });
  }

  const isRubric = style === "rubric";
  const rubricTotal = parts.reduce((s, p) => s + (Number(p.max) || 0), 0);
  const profileSummary = `${category} · ${difficultyIndex}/5 ${bandOf(difficultyIndex)}${sector ? ` · ${sector}` : ""}${topicId ? " · filed" : ""}`;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      {/* mobile: slide between compose and preview instead of stacking */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-soft lg:hidden">
        <button onClick={() => setMobilePane("compose")}
          className={cn("rounded-xl px-3 py-2 text-[13px] font-bold transition", mobilePane === "compose" ? "bg-slate-900 text-white" : "text-slate-500")}>
          Compose
        </button>
        <button onClick={() => setMobilePane("preview")}
          className={cn("flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-bold transition", mobilePane === "preview" ? "bg-slate-900 text-white" : "text-slate-500")}>
          <Eye className="h-4 w-4" /> Preview
        </button>
      </div>
      <div className={cn("grid gap-3", mobilePane === "preview" && "hidden lg:grid")}>
        <Card><CardContent className="grid gap-2.5 p-4">
          {/* format in one compact row */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(Object.keys(GROUPS) as QStyle[]).map((s) => (
              <Button key={s} size="sm" variant={style === s ? "default" : "outline"} onClick={() => applyType(GROUPS[s].types[0])}>
                {GROUPS[s].label}
              </Button>
            ))}
            <Select className="h-8 w-auto text-[13px]" value={type} onChange={(e) => applyType(e.target.value as QType)}>
              {GROUPS[style].types.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </Select>
            <span className="ml-auto flex items-center gap-1" title={`Difficulty ${difficultyIndex}/5 (${bandOf(difficultyIndex)})`}>
              {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} onClick={() => setDifficultyIndex(i)}
                  className={cn("h-6 w-6 rounded-md text-xs font-bold transition", i <= difficultyIndex ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400 hover:bg-slate-200")}>{i}</button>
              ))}
            </span>
          </div>

          <Textarea ref={stemRef} rows={3} placeholder={type === "fill_in" ? "e.g. Cardiac output = ___ × ___." : isRubric ? "e.g. Station 3: examine the cardiovascular system in 8 minutes." : "Question stem…"} value={stem} onChange={(e) => setStem(e.target.value)} />
          {type === "fill_in" && (
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <Button size="sm" variant="secondary" onClick={insertGap}><Plus className="h-3.5 w-3.5" /> Gap ___</Button>
              <span className="text-slate-500">{gaps} gap{gaps === 1 ? "" : "s"}</span>
            </div>
          )}

          {["mcq", "multi_select"].includes(type) && (
            <div className="grid gap-1.5">
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
              <Button size="sm" variant="outline" className="w-fit" onClick={() => setOptions([...options, ""])}><Plus className="h-3.5 w-3.5" /> Option</Button>
            </div>
          )}

          {type === "true_false" && (
            <div className="flex gap-2">
              {["True", "False"].map((o) => (
                <Button key={o} variant={correct.includes(o) ? "default" : "outline"} onClick={() => setCorrect([o])}>{o}</Button>
              ))}
            </div>
          )}

          {type === "mtf" && (
            <div className="grid gap-1.5">
              {parts.map((p, i) => (
                <div key={i} className="flex min-w-0 items-center gap-2">
                  <Input placeholder={`Statement ${i + 1}`} value={p.stem ?? ""} onChange={(e) => setPart(i, { stem: e.target.value })} />
                  <div className="flex shrink-0 gap-1">
                    {(["True", "False"] as const).map((v) => (
                      <Button key={v} size="sm" variant={(correct[i] ?? "True") === v ? "default" : "outline"} onClick={() => setCorrect((c) => { const n = [...c]; n[i] = v; return n; })}>{v[0]}</Button>
                    ))}
                  </div>
                  {parts.length > 2 && <Button size="icon" variant="ghost" onClick={() => removePart(i)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              ))}
              <Button size="sm" variant="outline" className="w-fit" onClick={addPart}><Plus className="h-3.5 w-3.5" /> Statement</Button>
            </div>
          )}

          {type === "sct" && (
            <div className="flex flex-wrap gap-1.5">
              {SCT_SCALE.map((s) => (
                <Button key={s} size="sm" variant={correct[0] === s ? "default" : "outline"} onClick={() => setCorrect([s])}>{s}</Button>
              ))}
            </div>
          )}

          {(type === "emq" || type === "matching") && (
            <div className="grid gap-2">
              {parts.map((p, i) => (
                <div key={i} className="grid gap-1 rounded-xl bg-slate-50 p-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Input placeholder={`Sub-question ${i + 1}`} value={p.stem ?? ""} onChange={(e) => setPart(i, { stem: e.target.value })} />
                    {parts.length > 1 && <Button size="icon" variant="ghost" onClick={() => removePart(i)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                  <Select value={correct[i] ?? ""} onChange={(e) => setCorrect((c) => { const n = [...c]; n[i] = e.target.value; return n; })}>
                    <option value="">Match to…</option>
                    {options.filter((o) => o.trim()).map((o) => <option key={o} value={o}>{o}</option>)}
                  </Select>
                </div>
              ))}
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" onClick={addPart}><Plus className="h-3.5 w-3.5" /> Sub-question</Button>
              </div>
              <div className="grid gap-1.5">
                {options.map((o, i) => (
                  <div key={i} className="flex min-w-0 items-center gap-2">
                    <Input placeholder={`Shared option ${String.fromCharCode(65 + i)}`} value={o} onChange={(e) => { const n = [...options]; n[i] = e.target.value; setOptions(n); }} />
                    {options.length > 2 && <Button size="icon" variant="ghost" onClick={() => setOptions(options.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                ))}
                <Button size="sm" variant="outline" className="w-fit" onClick={() => setOptions([...options, ""])}><Plus className="h-3.5 w-3.5" /> Shared option</Button>
              </div>
            </div>
          )}

          {(type === "kfq" || type === "meq" || type === "compound") && (
            <div className="grid gap-1.5">
              {parts.map((p, i) => (
                <div key={i} className="grid gap-1 rounded-xl bg-slate-50 p-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Input placeholder={type === "meq" ? `Step ${i + 1}` : `Key question ${i + 1}`} value={p.stem ?? ""} onChange={(e) => setPart(i, { stem: e.target.value })} />
                    {parts.length > 1 && <Button size="icon" variant="ghost" onClick={() => removePart(i)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                  <Input placeholder="Expected (|| for alternatives)" value={correct[i] ?? ""} onChange={(e) => setCorrect((c) => { const n = [...c]; n[i] = e.target.value; return n; })} />
                </div>
              ))}
              <Button size="sm" variant="outline" className="w-fit" onClick={addPart}><Plus className="h-3.5 w-3.5" /> {type === "meq" ? "Step" : "Question"}</Button>
            </div>
          )}

          {type === "saq" && (
            <div className="grid gap-1.5">
              {correct.map((a, i) => (
                <div key={i} className="flex min-w-0 items-center gap-2">
                  <Input placeholder={`Accepted answer ${i + 1}`} value={a} onChange={(e) => setCorrect((c) => { const n = [...c]; n[i] = e.target.value; return n; })} />
                  {correct.length > 1 && <Button size="icon" variant="ghost" onClick={() => setCorrect(correct.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              ))}
              <Button size="sm" variant="outline" className="w-fit" onClick={() => setCorrect([...correct, ""])}><Plus className="h-3.5 w-3.5" /> Alternative</Button>
            </div>
          )}

          {type === "fill_in" && (
            <div className="grid gap-1.5 rounded-xl bg-slate-50 p-2.5">
              {syncedCorrect().map((a, i) => (
                <label key={i} className="yrk-label flex items-center gap-2">Gap {i + 1}<Input placeholder={`Answer ${i + 1}`} value={a} onChange={(e) => setGapAnswer(i, e.target.value)} /></label>
              ))}
              {gaps < 1 && <span className="yrk-hint">Add a ___ in the stem to create gaps.</span>}
            </div>
          )}

          {isRubric && (
            <div className="grid gap-1.5">
              {parts.map((p, i) => (
                <div key={i} className="flex min-w-0 items-center gap-2">
                  <Input placeholder={`Criterion ${i + 1}`} value={p.label ?? ""} onChange={(e) => setPart(i, { label: e.target.value })} />
                  <Input type="number" min={1} max={100} className="w-[72px] shrink-0" placeholder="Max" value={p.max ?? ""} onChange={(e) => setPart(i, { max: Number(e.target.value) })} />
                  {parts.length > 1 && <Button size="icon" variant="ghost" onClick={() => removePart(i)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={addPart}><Plus className="h-3.5 w-3.5" /> Criterion</Button>
                <span className="text-xs text-slate-400">Total {rubricTotal}</span>
              </div>
            </div>
          )}

          <Textarea rows={2} placeholder={["essay", "short_answer", "saq"].includes(type) || isRubric ? "Marking guide — what earns full marks?" : "Explanation — why is it right?"} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
        </CardContent></Card>

        {/* profile, collapsed unless filled */}
        <Card><CardContent className="p-0">
          <button onClick={() => setProfileOpen((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
            <ChevronDown className={cn("h-4 w-4 text-slate-400 transition", !profileOpen && "-rotate-90")} />
            <span className="text-[13px] font-bold">Question profile</span>
            <span className="truncate text-xs text-slate-400">{profileSummary}</span>
          </button>
          {profileOpen && (
            <div className="grid gap-2.5 border-t border-slate-100 p-4 sm:grid-cols-2">
              <label className="yrk-label">Category
                <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="primary">Primary</option><option value="secondary">Secondary</option>
                  <option value="tertiary">Tertiary</option><option value="professional">Professional</option>
                  <option value="other">Other</option>
                </Select>
              </label>
              <label className="yrk-label">Sector
                <Input placeholder="e.g. Medicine & Surgery" value={sector} onChange={(e) => setSector(e.target.value)} list="yrk-sectors" />
                <datalist id="yrk-sectors"><option value="Medicine & Surgery" /><option value="Public Health" /><option value="Geology" /><option value="Engineering" /></datalist>
              </label>
              <label className="yrk-label">Subject → Topic
                <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                  <option value="">General (no topic)</option>
                  {topics.map((t) => <option key={t.id} value={t.id}>{t.exam} › {t.subject} › {t.name}</option>)}
                </Select>
              </label>
              <label className="yrk-label">Tags
                <Input placeholder="cardio, finals" value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} />
              </label>
              <label className="yrk-label sm:col-span-2">Media link
                <Input placeholder="https://… image, audio or video" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} />
              </label>
            </div>
          )}
        </CardContent></Card>

        {/* sticky action bar */}
        <div className="sticky-safe sticky bottom-3 z-10 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-3.5 py-2.5 shadow-lift backdrop-blur">
          <span className={cn("min-w-0 flex-1 truncate text-[13px]", errors.length ? "font-medium text-amber-700" : "text-slate-400")} title={errors.join(" ")}>
            {errors.length ? `${errors.length} to fix · ${errors[0]}` : "Ready"}
          </span>
          <Button variant="accent" size="sm" onClick={submit} disabled={!!strict && !!errors.length} title={strict && errors.length ? errors[0] : submitLabel}>{submitLabel}</Button>
        </div>
      </div>

      <Card className={cn("h-fit lg:sticky lg:top-20", mobilePane === "preview" ? "yrk-fade" : "hidden lg:block")}><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Eye className="h-4 w-4 text-indigo-600" /> Preview</CardTitle><CardDescription>How it reads in play.</CardDescription></CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div className="font-medium leading-snug break-words">{stem || <span className="text-slate-400">Stem appears here…</span>}</div>
          {["mcq", "multi_select"].includes(type) && options.filter((o) => o.trim()).map((o) => (
            <div key={o} className={cn("rounded-lg border px-3 py-2", correct.includes(o) ? "border-emerald-300 bg-emerald-50" : "border-slate-200")}>{o}</div>
          ))}
          {type === "mtf" && parts.map((p, i) => (
            <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px]"><span className="min-w-0 truncate">{p.stem || `Statement ${i + 1}`}</span><span className="shrink-0 font-bold text-emerald-700">{correct[i] ?? "True"}</span></div>
          ))}
          {type === "sct" && <div className="text-[13px] text-slate-500">Expert: {correct[0] || "—"}</div>}
          {(type === "emq" || type === "matching" || type === "kfq" || type === "meq" || type === "compound") && (
            <div className="text-[13px] text-slate-500">{parts.length} sub-question{parts.length === 1 ? "" : "s"}</div>
          )}
          {type === "fill_in" && <div className="text-slate-500">{gaps} blank{gaps === 1 ? "" : "s"}</div>}
          {type === "saq" && <div className="text-slate-500">Accepts: {correct.filter(Boolean).join(" / ") || "—"}</div>}
          {isRubric && <div className="text-[13px] text-slate-500">{parts.length} criteria · {rubricTotal} marks</div>}
          <div className="flex flex-wrap gap-1.5"><Badge tone="draft">{TYPE_LABEL[type]}</Badge><Badge tone={bandOf(difficultyIndex)}>{difficultyIndex}/5</Badge></div>
        </CardContent>
      </Card>
    </div>
  );
}
