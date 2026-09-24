"use client";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { PageHero } from "@/components/page-hero";
import { toast } from "@/components/ui/toast";
import { CheckCircle2, XCircle, Flag, Timer, ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";

interface Q { id: string; stem: string; options: string; correct: string; explanation: string; difficulty: string; type: string; }
interface Topic { id: string; name: string; subject: string; exam: string; }
type Phase = "setup" | "running" | "results";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export default function QuizPage() {
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const [phase, setPhase] = useState<Phase>("setup");
  const [mode, setMode] = useState<"practice" | "exam">("practice");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicId, setTopicId] = useState(search.get("topicId") ?? "");
  const [subjectId, setSubjectId] = useState(search.get("subjectId") ?? "");
  const [subjectName, setSubjectName] = useState("");
  const [count, setCount] = useState(10);
  const [minutes, setMinutes] = useState(10);
  const [items, setItems] = useState<Q[]>([]); // snapshot
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [seconds, setSeconds] = useState(600);
  const [result, setResult] = useState<{ score: number; total: number; wrongIds: string[]; late?: boolean } | null>(null);
  const [error, setError] = useState("");
  const [startedAt, setStartedAt] = useState(0);

  useEffect(() => { fetch("/api/topics").then((r) => r.json()).then(setTopics).catch(() => {}); }, []);
  useEffect(() => {
    if (subjectId) fetch(`/api/subjects/${subjectId}`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setSubjectName(d.subject.name)).catch(() => {});
  }, [subjectId]);
  useEffect(() => {
    if (phase !== "running" || mode !== "exam" || result) return;
    if (seconds <= 0) { submitAll(true); return; }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, phase, mode, result]);

  const cur = items[idx];
  const opts: string[] = useMemo(() => (cur ? (JSON.parse(cur.options) as string[]) : []), [cur]);
  const correct: string[] = useMemo(() => (cur ? (JSON.parse(cur.correct) as string[]) : []), [cur]);
  const picked: string[] = cur ? (answers[cur.id] ?? []) : [];
  const progress = items.length ? Math.round((Object.keys(answers).length / items.length) * 100) : 0;

  async function start() {
    setError("");
    const params = new URLSearchParams();
    if (topicId) params.set("topicId", topicId);
    else if (subjectId) params.set("subjectId", subjectId);
    params.set("take", "500");
    const res = await fetch(`/api/bank?${params.toString()}`);
    if (!res.ok) { setError("Could not load bank"); return; }
    let all = (await res.json() as Q[]);
    all = shuffle(all).slice(0, Math.max(1, Math.min(count, all.length || count)));
    if (!all.length) { setError("No questions for this filter, try All topics"); return; }
    setItems(all); // snapshot frozen
    setIdx(0); setAnswers({}); setFlagged({}); setResult(null);
    setSeconds(minutes * 60);
    setStartedAt(Date.now());
    setPhase("running");
  }

  function toggleOpt(o: string) {
    if (!cur || result) return;
    setAnswers((a) => {
      const prev = a[cur.id] ?? [];
      if (cur.type === "multi_select") {
        return { ...a, [cur.id]: prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o] };
      }
      return { ...a, [cur.id]: [o] };
    });
  }

  function setText(v: string) {
    if (!cur) return;
    setAnswers((a) => ({ ...a, [cur.id]: [v] }));
  }

  function setGap(i: number, v: string) {
    if (!cur) return;
    setAnswers((a) => {
      const prev = [...(a[cur.id] ?? [])];
      while (prev.length <= i) prev.push("");
      prev[i] = v;
      return { ...a, [cur.id]: prev };
    });
  }

  function isCorrect(q: Q, given: string[]): boolean {
    const c = JSON.parse(q.correct) as string[];
    if (q.type === "essay" || q.type === "short_answer") return given.join(" ").trim().length >= 3;
    if (q.type === "fill_in") {
      if (given.length !== c.length) return false;
      return c.every((x, i) => ((given[i] ?? "").trim().toLowerCase() === x.trim().toLowerCase()));
    }
    return [...given].sort().join("|").toLowerCase() === [...c].sort().join("|").toLowerCase();
  }

  async function submitAll(auto = false) {
    // Whole snapshot goes: server grades every snapshotted question so
    // blanks count as wrong, and enforces the filter + exam clock.
    const payload = items.map((q) => ({ questionId: q.id, given: answers[q.id] ?? [] }));
    const res = await fetch("/api/quiz/attempts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, topicId, subjectId, questionIds: items.map((q) => q.id), answers: payload, startedAt, durationSecs: mode === "exam" ? minutes * 60 : undefined }) });
    if (res.status === 401) { window.location.href = "/login"; return; }
    const data = await res.json();
    // per-question wrong ids for review + retry
    const wrongIds: string[] = [];
    for (const q of items) {
      if (!isCorrect(q, answers[q.id] ?? [])) wrongIds.push(q.id);
    }
    void auto;
    setResult({ score: data.score ?? 0, total: items.length, wrongIds, late: data.late });
    if (data.late) toast("Submitted after time, scored zero. The clock is server-side.");
    setPhase("results");
  }

  function retryWrong() {
    const wrong = items.filter((q) => result?.wrongIds.includes(q.id));
    if (!wrong.length) return;
    setItems(wrong); setIdx(0); setAnswers({}); setFlagged({}); setResult(null);
    setSeconds(minutes * 60); setStartedAt(Date.now()); setPhase("running");
  }

  if (phase === "setup") {
    return (
      <div className="grid gap-5">
        <PageHero eyebrow="Quiz" title="Start sharp" description="Frozen at start. Practice guides instantly; exams run the clock." tone="dark" />
        <div className="mx-auto grid w-full max-w-2xl gap-4">
        <Card><CardHeader><CardTitle>Configure your round</CardTitle><CardDescription>Segment, size and pace.</CardDescription></CardHeader><CardContent className="grid gap-4">
          <div className="flex gap-2">
            <Button variant={mode === "practice" ? "default" : "outline"} onClick={() => setMode("practice")}>Practice · instant</Button>
            <Button variant={mode === "exam" ? "default" : "outline"} onClick={() => setMode("exam")}>Exam · timed</Button>
          </div>
          <label className="yrk-label">Topic
            <Select className="mt-1" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              <option value="">All topics{subjectName ? ` in ${subjectName}` : ""}</option>
              {topics.map((t) => <option key={t.id} value={t.id}>{t.exam} · {t.subject} · {t.name}</option>)}
            </Select>
          </label>
          {subjectId && <div className="flex items-center gap-2 text-[13px]"><span className="rounded-full bg-indigo-50 px-3 py-1 font-semibold text-indigo-700">Subject: {subjectName || subjectId}</span><button className="text-slate-400 underline" onClick={() => { setSubjectId(""); setSubjectName(""); }}>clear</button></div>}
          <div className="flex gap-3">
            <label className="yrk-label flex-1">Questions<Input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} /></label>
            {mode === "exam" && <label className="yrk-label flex-1">Minutes<Input type="number" min={1} max={120} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></label>}
          </div>
          {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">{error}</div>}
          <Button variant="accent" onClick={start}>Start · {count} Qs</Button>
        </CardContent></Card>
        </div>
      </div>
    );
  }

  if (phase === "results" && result) {
    return (
      <div className="grid gap-4">
        <PageHero eyebrow={mode === "exam" ? "Mock complete" : "Practice complete"} title={`${result.score}/${result.total} · ${result.total ? Math.round((result.score / result.total) * 100) : 0}%`} description={result.wrongIds.length ? `${result.wrongIds.length} to review, retry just the misses or check history.` : "Clean sweep. New segment or harder mix next."}
          actions={<><Button variant="outline" onClick={() => setPhase("setup")} className="w-full border-white/20 text-white hover:bg-white/10 hover:text-white sm:w-auto">New setup</Button>{result.wrongIds.length > 0 && <Button variant="accent" className="w-full sm:w-auto" onClick={retryWrong}><RotateCcw className="h-4 w-4" /> Retry {result.wrongIds.length} wrong</Button>}<a href="/quiz/history" className="w-full sm:w-auto"><Button variant="secondary" className="w-full sm:w-auto">History</Button></a></>} tone="dark" />
        {items.map((q, i) => {
          const g = answers[q.id] ?? [];
          const ok = isCorrect(q, g);
          const c = JSON.parse(q.correct) as string[];
          const isT = q.type === "essay" || q.type === "short_answer";
          return (
            <Card key={q.id} className={ok ? "border-green-200" : "border-red-200"}>
              <CardContent className="yrk-wrap p-4 text-sm">
                <div className="flex items-start gap-2 font-medium">{ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}<span className="min-w-0">Q{i + 1}. {q.stem}</span></div>
                <div className="mt-1 text-slate-500">{isT ? `Your answer: ${g.join(" ").slice(0, 200) || "(blank)"}` : `You: ${g.join(", ") || "(blank)"} · Answer: ${c.join(", ")}`}</div>
                <div className="mt-1">{isT ? `Marking guide: ${q.explanation}` : q.explanation}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  if (!cur) return <div className="text-sm">Loading…</div>;
  const isMulti = cur.type === "multi_select";
  const isFill = cur.type === "fill_in";
  const isTheory = cur.type === "essay" || cur.type === "short_answer";

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <div className="grid gap-4">
        <Card><CardContent className="p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px] sm:text-sm">
            <span className="min-w-0">{mode === "practice" ? "Practice" : "Exam"} · Q{idx + 1}/{items.length} · {cur.type} · {cur.difficulty}</span>
            {mode === "exam" && <span className="flex shrink-0 items-center gap-1 font-semibold tabular-nums"><Timer className="h-4 w-4" />{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-slate-900" style={{ width: `${progress}%` }} /></div>
        </CardContent></Card>
        <Card>
          <CardHeader><CardTitle className="yrk-wrap text-lg">{cur.stem}</CardTitle>
            <div className="text-xs text-slate-500">{isMulti ? "Pick all that apply" : isFill ? "Type your answer" : isTheory ? (cur.type === "essay" ? "Theory, long answer, compare with marking guide" : "Theory, short answer") : "Pick one"}{flagged[cur.id] ? " · flagged" : ""}</div>
          </CardHeader>
          <CardContent className="grid gap-2">
            {!isFill && !isTheory && opts.map((o) => {
              const sel = picked.includes(o);
              const show = mode === "practice" && picked.length > 0;
              const right = correct.includes(o);
              return (
                <button key={o} onClick={() => toggleOpt(o)}
                  className={`flex min-w-0 items-center justify-between gap-2 rounded-xl border px-4 py-3.5 text-left text-sm transition active:scale-[0.99] ${sel ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:border-slate-400"} ${show && right ? "!border-green-600 !bg-green-50 !text-green-900" : ""} ${show && sel && !right ? "!border-red-600 !bg-red-50 !text-red-900" : ""}`}>
                  <span className="min-w-0 break-words">{o}</span>
                  {show && right && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                  {show && sel && !right && <XCircle className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
            {isFill && (
              <div className="grid gap-2 rounded-xl bg-slate-50 p-3 text-[15px] leading-loose">
                {cur.stem.split("___").map((part, i, arr) => (
                  <span key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <input value={picked[i] ?? ""} onChange={(e) => setGap(i, e.target.value)}
                        placeholder={`gap ${i + 1}`}
                        className="mx-1 inline-block w-28 max-w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none sm:w-36" />
                    )}
                  </span>
                ))}
                {!cur.stem.includes("___") && <Input placeholder="Type answer…" value={picked[0] ?? ""} onChange={(e) => setText(e.target.value)} />}
              </div>
            )}
            {isTheory && (
              <textarea className="min-h-[120px] w-full rounded-md border border-slate-200 p-3 text-sm" placeholder={cur.type === "essay" ? "Write your essay answer…" : "Write a concise answer…"} value={picked[0] ?? ""} onChange={(e) => setText(e.target.value)} />
            )}
            {mode === "practice" && picked.length > 0 && !isFill && !isTheory && (
              <div className="rounded-lg bg-slate-50 p-3 text-sm">{correct.sort().join("|") === [...picked].sort().join("|") ? "Correct. " : `Answer: ${correct.join(", ")}. `}{cur.explanation}</div>
            )}
            {mode === "practice" && ((isFill && picked.length > 0 && picked[0]) || (isTheory && picked.length > 0 && picked[0])) && (
              <div className="rounded-lg bg-slate-50 p-3 text-sm"><span className="font-medium">{isTheory ? "Marking guide, compare: " : ""}</span>{cur.explanation}</div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button variant="outline" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}><ArrowLeft className="h-4 w-4" /> Prev</Button>
              <Button variant="outline" disabled={idx >= items.length - 1} onClick={() => setIdx((i) => i + 1)}>Next <ArrowRight className="h-4 w-4" /></Button>
              <Button variant="outline" onClick={() => setFlagged((f) => ({ ...f, [cur.id]: !f[cur.id] }))}><Flag className="h-4 w-4" />{flagged[cur.id] ? "Unflag" : "Flag"}</Button>
              <Button className="w-full min-[420px]:ml-auto min-[420px]:w-auto" onClick={() => submitAll()}>Finish</Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="h-fit"><CardHeader><CardTitle className="text-sm">Palette</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {items.map((q, i) => (
            <button key={q.id} onClick={() => setIdx(i)} title={q.stem}
              className={`flex h-9 w-9 items-center justify-center rounded-md border text-xs ${i === idx ? "border-slate-900 bg-slate-900 text-white" : answers[q.id]?.length ? "border-green-600 bg-green-50 text-green-900" : "border-slate-200 bg-white"} ${flagged[q.id] ? "ring-2 ring-amber-400" : ""}`}>{i + 1}</button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
