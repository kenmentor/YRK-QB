"use client";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { PageHero } from "@/components/page-hero";
import { NewActivityButton } from "@/components/new-activity-button";
import { toast } from "@/components/ui/toast";
import { CheckCircle2, XCircle, Flag, Timer, ArrowLeft, ArrowRight, RotateCcw, GripVertical, X, LayoutGrid } from "lucide-react";

interface QPart { stem?: string; label?: string; max?: number; }
interface Q { id: string; stem: string; options: string; parts?: string; correct?: string; explanation?: string; difficulty: string; type: string; }
interface Topic { id: string; name: string; subject: string; exam: string; }
interface PartRow { stem: string; given: string[]; expected: string[]; ok: boolean; }
interface Breakdown { questionId: string; stem: string; given: string[]; correctAnswers: string[]; explanation: string; ok: boolean; type: string; parts?: PartRow[]; }
type Phase = "setup" | "running" | "results";
type Mode = "practice" | "selftest" | "exam";

const MODE_LABEL: Record<Mode, string> = { practice: "Practice", selftest: "Self test", exam: "Test" };
const SCT_SCALE = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];
const RUBRIC = ["osce", "dops", "minicex", "msf", "viva"];
const PARTS_Q = ["mtf", "emq", "matching", "kfq", "meq", "compound"];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function jsParts(raw?: string): QPart[] {
  try { const a = raw ? JSON.parse(raw) : []; return Array.isArray(a) ? a : []; } catch { return []; }
}

function jsArr(raw?: string): string[] {
  try { const a = raw ? JSON.parse(raw) : []; return Array.isArray(a) ? a : []; } catch { return []; }
}

function matchAlt(given: string, expected: string): boolean {
  const g = given.trim().toLowerCase();
  if (!g) return false;
  return expected.split("||").map((x) => x.trim().toLowerCase()).includes(g);
}

function isCorrect(q: Q, given: string[]): boolean {
  const c = jsArr(q.correct);
  if (q.type === "essay" || q.type === "short_answer") return given.join(" ").trim().length >= 3;
  if (q.type === "saq") { const g = (given[0] ?? "").trim().toLowerCase(); return !!g && c.some((x) => x.trim().toLowerCase() === g); }
  if (q.type === "sct") return !!given[0] && given[0] === c[0];
  if (q.type === "mtf" || q.type === "emq" || q.type === "matching" || q.type === "fill_in") {
    if (given.length !== c.length) return false;
    return c.every((x, i) => ((given[i] ?? "").trim().toLowerCase() === x.trim().toLowerCase()));
  }
  if (q.type === "kfq" || q.type === "meq" || q.type === "compound") {
    if (given.length !== c.length) return false;
    return c.every((x, i) => matchAlt(given[i] ?? "", x));
  }
  if (RUBRIC.includes(q.type)) {
    // Client-side approximation: half marks or better.
    const parts = jsParts(q.parts);
    const total = parts.reduce((s, p) => s + (Number(p.max) || 0), 0);
    if (!total) return false;
    const got = (given as unknown as number[]).reduce((s, v) => s + (Number(v) || 0), 0);
    return got >= total / 2;
  }
  if (!c.length) return false;
  return [...given].sort().join("|").toLowerCase() === [...c].sort().join("|").toLowerCase();
}

export default function QuizPage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [mode, setMode] = useState<Mode>("practice");
  const [setId, setSetId] = useState("");
  const [setTitle, setSetTitle] = useState("");
  const [activityId, setActivityId] = useState("");
  const [activityTitle, setActivityTitle] = useState("");
  const [activities, setActivities] = useState<{ id: string; title: string; banner: string; ownerName: string; questionCount: number; modes: string[]; visibility?: string; category?: string; sector?: string }[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicId, setTopicId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [count, setCount] = useState(10);
  const [minutes, setMinutes] = useState(10);
  const [items, setItems] = useState<Q[]>([]); // snapshot
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [rubric, setRubric] = useState<Record<string, number[]>>({}); // per-criterion scores
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [meqShown, setMeqShown] = useState<Record<string, number>>({});
  const [seconds, setSeconds] = useState(600);
  const [showPalette, setShowPalette] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number; wrongIds: string[]; late?: boolean; breakdown?: Breakdown[] } | null>(null);
  const [wrongOnly, setWrongOnly] = useState(false);
  const [error, setError] = useState("");
  const [startedAt, setStartedAt] = useState(0);
  const [ticket, setTicket] = useState("");

  // URL deep-links (?mode=&set=&activity=&topicId=&subjectId=) apply after
  // mount so server and client render identically (no hydration mismatch).
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const m = search.get("mode");
    if (m === "practice" || m === "selftest" || m === "exam") setMode(m);
    const s = search.get("set");
    if (s) setSetId(s);
    const a = search.get("activity");
    if (a) setActivityId(a);
    const t = search.get("topicId");
    if (t) setTopicId(t);
    const sj = search.get("subjectId");
    if (sj) setSubjectId(sj);
  }, []);
  useEffect(() => { fetch("/api/topics").then((r) => r.json()).then(setTopics).catch(() => {}); }, []);
  useEffect(() => {
    if (subjectId) fetch(`/api/subjects/${subjectId}`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setSubjectName(d.subject.name)).catch(() => {});
  }, [subjectId]);
  useEffect(() => {
    if (setId) fetch(`/api/exam-sets/${setId}`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setSetTitle(d.set.title)).catch(() => {});
  }, [setId]);
  useEffect(() => {
    if (activityId) fetch(`/api/activities/${activityId}`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setActivityTitle(d.meta.title)).catch(() => {});
  }, [activityId]);
  useEffect(() => {
    Promise.all(["mine", "shared", "public"].map((s) => fetch(`/api/activities?scope=${s}`).then((r) => (r.ok ? r.json() : [])))).then(([m, sh, p]) => {
      const seen = new Set<string>();
      const all = [...(m ?? []), ...(sh ?? []), ...(p ?? [])].filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
      setActivities(all);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (phase !== "running" || mode === "practice" || result) return;
    if (seconds <= 0) { submitAll(true); return; }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, phase, mode, result]);

  const cur = items[idx];
  const opts: string[] = useMemo(() => (cur ? jsArr(cur.options) : []), [cur]);
  const parts: QPart[] = useMemo(() => (cur ? jsParts(cur.parts) : []), [cur]);
  // Exam items arrive stripped (no correct/answers); practice/self-test items are full.
  const correct: string[] = useMemo(() => (cur?.correct ? jsArr(cur.correct) : []), [cur]);
  const picked: string[] = cur ? (answers[cur.id] ?? []) : [];
  const rScores: number[] = cur ? (rubric[cur.id] ?? []) : [];
  const isRubric = cur ? RUBRIC.includes(cur.type) : false;
  const answeredCount = items.filter((q) => (answers[q.id]?.some((a) => String(a).trim()) || (rubric[q.id]?.some((v) => Number(v) > 0))));
  const progress = items.length ? Math.round((answeredCount.length / items.length) * 100) : 0;

  async function start() {
    setError("");
    let res: Response;
    try {
      if (mode === "exam") {
        // Server picks + freezes the snapshot and signs the clock. Answers
        // stay server-side until grading. Exam sets keep their order.
        res = await fetch("/api/quiz/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topicId: topicId || undefined, subjectId: subjectId || undefined, setId: setId || undefined, activityId: activityId || undefined, count, minutes }) });
      } else if (activityId) {
        res = await fetch(`/api/activities/${activityId}`);
      } else if (setId) {
        res = await fetch(`/api/exam-sets/${setId}`);
      } else {
        const params = new URLSearchParams();
        if (topicId) params.set("topicId", topicId);
        else if (subjectId) params.set("subjectId", subjectId);
        params.set("take", "500");
        res = await fetch(`/api/bank?${params.toString()}`);
      }
    } catch {
      setError("Couldn't reach the server — is it running?");
      return;
    }
    if (mode === "exam") {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Could not start test"); return; }
      if (data.skipped) toast(`${data.skipped} set question${data.skipped === 1 ? " is" : "s are"} no longer live, skipped.`);
      setItems(data.items);
      setTicket(data.ticket);
      setIdx(0); setAnswers({}); setRubric({}); setFlagged({}); setMeqShown({}); setResult(null);
      setSeconds(data.durationSecs);
      setStartedAt(data.startedAt);
      setPhase("running");
      return;
    }
    let all: Q[];
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? "Could not load questions"); return; }
    if (activityId) {
      all = ((data.items ?? []) as Q[]);
      if (!all.length) { setError("Activity has no live questions"); return; }
    } else if (setId) {
      all = ((data.questions ?? []) as Q[]).filter((q) => q.type !== "missing");
      if (!all.length) { setError("Exam set has no live questions"); return; }
    } else {
      all = shuffle((Array.isArray(data) ? data : []) as Q[]).slice(0, Math.max(1, Math.min(count, 500)));
      if (!all.length) { setError("No questions for this filter, try All topics"); return; }
    }
    setItems(all); // snapshot frozen (set order kept for exam sets)
    setIdx(0); setAnswers({}); setRubric({}); setFlagged({}); setMeqShown({}); setResult(null); setTicket("");
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

  function setPart(i: number, v: string) {
    if (!cur) return;
    setAnswers((a) => {
      const prev = [...(a[cur.id] ?? [])];
      while (prev.length <= (parts.length || 1)) prev.push("");
      prev[i] = v;
      return { ...a, [cur.id]: prev };
    });
  }

  function setCriterion(i: number, v: number, max: number) {
    if (!cur) return;
    const clamped = Math.min(Math.max(Math.round(v) || 0, 0), max);
    setRubric((r) => {
      const prev = [...(r[cur.id] ?? [])];
      while (prev.length < parts.length) prev.push(0);
      prev[i] = clamped;
      return { ...r, [cur.id]: prev };
    });
  }

  function rubricTotal(): number {
    return parts.reduce((s, p) => s + (Number(p.max) || 0), 0);
  }

  async function submitAll(auto = false) {
    // Whole snapshot goes: server grades every snapshotted question so
    // blanks count as wrong. Test mode additionally sends the signed
    // ticket (server snapshot + clock); self test sends a soft client
    // clock; practice sends its own snapshot. Rubric totals go as manual.
    const payload = items.map((q) => ({ questionId: q.id, given: answers[q.id] ?? [] }));
    const manual = items.filter((q) => RUBRIC.includes(q.type)).map((q) => ({
      questionId: q.id, score: (rubric[q.id] ?? []).reduce((s, v) => s + (Number(v) || 0), 0),
    }));
    const body = mode === "exam"
      ? { mode, ticket, answers: payload, manual }
      : { mode, topicId, subjectId, questionIds: items.map((q) => q.id), answers: payload, manual, ...(mode === "selftest" ? { startedAt, durationSecs: minutes * 60 } : {}) };
    let res: Response;
    try {
      res = await fetch("/api/quiz/attempts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch {
      setError("Couldn't reach the server — your answers are kept, retry submit.");
      return;
    }
    if (res.status === 401) { window.location.href = "/login"; return; }
    if (res.status === 400) { const d = await res.json(); setError(d.error ?? "Submit rejected, restart the round."); setPhase("setup"); return; }
    const data = await res.json();
    const bd = (data.breakdown ?? []) as Breakdown[];
    const wrongIds = bd.length ? bd.filter((b) => !b.ok).map((b) => b.questionId) : items.filter((q) => !isCorrect(q, answers[q.id] ?? [])).map((q) => q.id);
    void auto;
    void startedAt;
    setResult({ score: data.score ?? 0, total: items.length, wrongIds, late: data.late, breakdown: bd.length ? bd : undefined });
    if (data.late) toast("Submitted after time, scored zero. The clock is server-side.");
    setPhase("results");
  }

  function retryWrong() {
    // Test rounds are ticket-bound: retrying a subset would void the ticket,
    // so tests restart fresh while practice/self test retry just the misses.
    if (mode === "exam") { start(); return; }
    const wrong = items.filter((q) => result?.wrongIds.includes(q.id));
    if (!wrong.length) return;
    setWrongOnly(false);
    setItems(wrong); setIdx(0); setAnswers({}); setRubric({}); setFlagged({}); setMeqShown({}); setResult(null);
    setSeconds(minutes * 60); setStartedAt(Date.now()); setPhase("running");
  }

  if (phase === "setup") {
    const sourceId = activityId || setId;
    return (
      <div className="grid gap-5">
        <PageHero eyebrow="Play" title="Start sharp" description="Frozen at start. Practice guides instantly, self test runs a soft clock, test runs the strict server clock." tone="dark" />
        {!!activities.length && !sourceId && <ActivityPicker activities={activities} mode={mode} />}
        <div className="mx-auto grid w-full max-w-2xl gap-4">
        <Card><CardHeader><CardTitle>Configure your round</CardTitle><CardDescription>Segment, size and pace.</CardDescription></CardHeader><CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Button variant={mode === "practice" ? "default" : "outline"} onClick={() => setMode("practice")}>Practice · instant</Button>
            <Button variant={mode === "selftest" ? "default" : "outline"} onClick={() => setMode("selftest")}>Self test · timed</Button>
            <Button variant={mode === "exam" ? "default" : "outline"} onClick={() => setMode("exam")}>Test · strict</Button>
          </div>
          {activityId && <div className="flex items-center gap-2 text-[13px]"><span className="rounded-full bg-indigo-50 px-3 py-1 font-semibold text-indigo-700">Activity: {activityTitle || activityId}</span><button className="text-slate-400 underline" onClick={() => { setActivityId(""); setActivityTitle(""); }}>clear</button></div>}
          {setId && <div className="flex items-center gap-2 text-[13px]"><span className="rounded-full bg-indigo-50 px-3 py-1 font-semibold text-indigo-700">Exam set: {setTitle || setId}</span><button className="text-slate-400 underline" onClick={() => { setSetId(""); setSetTitle(""); }}>clear</button></div>}
          {!sourceId && <>
          <label className="yrk-label">Topic
            <Select className="mt-1" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              <option value="">All topics{subjectName ? ` in ${subjectName}` : ""}</option>
              {topics.map((t) => <option key={t.id} value={t.id}>{t.exam} · {t.subject} · {t.name}</option>)}
            </Select>
          </label>
          {subjectId && <div className="flex items-center gap-2 text-[13px]"><span className="rounded-full bg-indigo-50 px-3 py-1 font-semibold text-indigo-700">Subject: {subjectName || subjectId}</span><button className="text-slate-400 underline" onClick={() => { setSubjectId(""); setSubjectName(""); }}>clear</button></div>}
          </>}
          <div className="flex gap-3">
            {!sourceId && <label className="yrk-label flex-1">Questions<Input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} /></label>}
            {mode !== "practice" && <label className="yrk-label flex-1">Minutes<Input type="number" min={1} max={120} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></label>}
          </div>
          {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">{error}</div>}
          <Button variant="accent" onClick={start}>Start{sourceId ? "" : ` · ${count} Qs`}</Button>
        </CardContent></Card>
        </div>
      </div>
    );
  }

  if (phase === "results" && result) {
    const rows: Breakdown[] = result.breakdown ?? items.map((q) => {
      const g = answers[q.id] ?? [];
      const c = jsArr(q.correct);
      return { questionId: q.id, stem: q.stem, given: g, correctAnswers: c, explanation: q.explanation ?? "", ok: isCorrect(q, g), type: q.type };
    });
    const shown = wrongOnly ? rows.filter((b) => !b.ok) : rows;
    const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
    return (
      <div className="grid gap-3">
        <Card className="overflow-hidden">
          <div className={`px-5 py-5 sm:px-6 ${pct >= 70 ? "bg-emerald-600" : pct >= 40 ? "bg-amber-500" : "bg-rose-600"}`}>
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">{mode === "exam" ? "Test complete" : mode === "selftest" ? "Self test complete" : "Practice complete"}</div>
            <div className="mt-0.5 text-3xl font-black tabular-nums text-white">{result.score}/{result.total} · {pct}%</div>
            <div className="mt-1 text-[13px] text-white/85">{result.wrongIds.length ? `${result.wrongIds.length} to review.` : "Clean sweep."}</div>
          </div>
          <CardContent className="flex flex-wrap gap-2 p-3">
            <Button variant="outline" size="sm" onClick={() => { setWrongOnly(false); setPhase("setup"); }}>New setup</Button>
            {result.wrongIds.length > 0 && <Button variant="accent" size="sm" onClick={retryWrong}><RotateCcw className="h-4 w-4" /> Retry {result.wrongIds.length} wrong</Button>}
            <a href="/play/history"><Button variant="secondary" size="sm">History</Button></a>
            {!!result.wrongIds.length && (
              <button onClick={() => setWrongOnly((v) => !v)} className={`ml-auto rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${wrongOnly ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:text-slate-800"}`}>
                Wrong only{wrongOnly ? ` (${shown.length})` : ""}
              </button>
            )}
          </CardContent>
        </Card>
        <div className="mx-auto grid w-full max-w-2xl gap-2.5">
        {shown.map((b) => {
          const n = rows.indexOf(b) + 1;
          const isT = b.type === "essay" || b.type === "short_answer";
          return (
            <Card key={b.questionId} className={b.ok ? "border-l-4 border-l-green-500" : "border-l-4 border-l-red-500"}>
              <CardContent className="yrk-wrap grid gap-2 p-4 text-sm">
                <div className="flex items-start gap-2 font-medium">{b.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}<span className="min-w-0">Q{n}. {b.stem}</span></div>
                {b.parts?.length ? (
                  <div className="grid gap-1">
                    {b.parts.map((p, j) => (
                      <div key={j} className={`flex flex-wrap items-center gap-x-2 rounded-lg px-2.5 py-1.5 text-[13px] ${p.ok ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"}`}>
                        <span className="font-medium">{p.stem}:</span>
                        <span>You: {p.given.join(", ") || "(blank)"}</span>
                        <span className="text-slate-500">· Expected: {p.expected.join(", ")}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500">{isT ? `Your answer: ${b.given.join(" ").slice(0, 200) || "(blank)"}` : `You: ${b.given.join(", ") || "(blank)"} · Answer: ${b.correctAnswers.join(", ")}`}</div>
                )}
                <div className="rounded-lg bg-slate-50 px-2.5 py-2 text-[13px]">{isT ? `Marking guide: ${b.explanation}` : b.explanation}</div>
              </CardContent>
            </Card>
          );
        })}
        </div>
      </div>
    );
  }

  if (!cur) return <div className="text-sm">Loading…</div>;
  const isMulti = cur.type === "multi_select";
  const isFill = cur.type === "fill_in";
  const isTheory = cur.type === "essay" || cur.type === "short_answer";
  const showInstant = mode === "practice" && !isRubric;
  const allPartsFilled = PARTS_Q.includes(cur.type) && parts.length > 0 && parts.every((_, i) => (picked[i] ?? "").trim());
  const instantOk = showInstant && isCorrect(cur, picked);

  const lowTime = mode !== "practice" && seconds <= 60;
  const letter = (i: number) => String.fromCharCode(65 + i);

  function exitRound() {
    if (Object.keys(answers).length && !confirm("Leave this round? Answers so far are lost.")) return;
    setPhase("setup");
  }

  return (
    <div className="grid gap-3">
      {/* runner top bar */}
      <div className="sticky top-16 z-20 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-soft backdrop-blur">
        <div className="flex items-center gap-2 px-3 py-2">
          <button title="Exit round" onClick={exitRound} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
            {MODE_LABEL[mode]} <span className="font-normal text-slate-400">· Q{idx + 1}/{items.length} · {cur.type.replace(/_/g, " ")} · {cur.difficulty}</span>
          </span>
          {flagged[cur.id] && <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800"><Flag className="h-3 w-3" />Flagged</span>}
          {mode !== "practice" && (
            <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-bold tabular-nums ${lowTime ? "bg-red-50 text-red-700" : "bg-slate-900 text-white"}`}>
              <Timer className="h-3.5 w-3.5" />{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
            </span>
          )}
          <button title="Questions" onClick={() => setShowPalette((v) => !v)}
            className={`rounded-lg p-1.5 transition lg:hidden ${showPalette ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
        <div className="h-1 bg-slate-100"><div className="h-full bg-slate-900 transition-all" style={{ width: `${progress}%` }} /></div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="mx-auto grid w-full max-w-2xl gap-3">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="yrk-wrap text-xl font-bold leading-snug">{cur.stem}</CardTitle>
            <div className="pt-1 text-xs text-slate-500">{hintFor(cur, parts)}</div>
          </CardHeader>
          <CardContent className="grid gap-2">
            {!isFill && !isTheory && !isRubric && !PARTS_Q.includes(cur.type) && cur.type !== "saq" && cur.type !== "sct" && opts.map((o, oi) => {
              const sel = picked.includes(o);
              const show = showInstant && picked.length > 0;
              const right = correct.includes(o);
              return (
                <button key={o} onClick={() => toggleOpt(o)}
                  className={`flex min-w-0 items-center gap-3 rounded-xl border px-3 py-3 text-left text-[15px] transition active:scale-[0.995] ${sel ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:border-slate-400"} ${show && right ? "!border-green-600 !bg-green-50 !text-green-900" : ""} ${show && sel && !right ? "!border-red-600 !bg-red-50 !text-red-900" : ""}`}>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-black ${sel ? "bg-white/20" : show && right ? "bg-green-600 text-white" : "bg-slate-100 text-slate-500"}`}>{letter(oi)}</span>
                  <span className="min-w-0 flex-1 break-words">{o}</span>
                  {show && right && <CheckCircle2 className="h-5 w-5 shrink-0" />}
                  {show && sel && !right && <XCircle className="h-5 w-5 shrink-0" />}
                </button>
              );
            })}
            {cur.type === "mtf" && parts.map((p, i) => (
              <div key={i} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm">
                <span className="min-w-0 break-words">{p.stem}</span>
                <span className="flex shrink-0 gap-1.5">
                  {(["True", "False"] as const).map((v) => {
                    const sel = (picked[i] ?? "") === v;
                    const show = showInstant && (picked[i] ?? "");
                    const right = (correct[i] ?? "") === v;
                    return (
                      <button key={v} onClick={() => setPart(i, v)}
                        className={`rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition ${sel ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 hover:border-slate-400"} ${show && right ? "!border-green-600 !bg-green-50 !text-green-900" : ""} ${show && sel && !right ? "!border-red-600 !bg-red-50 !text-red-900" : ""}`}>{v}</button>
                    );
                  })}
                </span>
              </div>
            ))}
            {cur.type === "sct" && (
              <div className="flex flex-wrap gap-1.5">
                {SCT_SCALE.map((s) => {
                  const sel = picked[0] === s;
                  const show = showInstant && picked[0];
                  const right = correct[0] === s;
                  return (
                    <button key={s} onClick={() => setText(s)}
                      className={`rounded-xl border px-3 py-2 text-[13px] transition ${sel ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 hover:border-slate-400"} ${show && right ? "!border-green-600 !bg-green-50 !text-green-900" : ""} ${show && sel && !right ? "!border-red-600 !bg-red-50 !text-red-900" : ""}`}>{s}</button>
                  );
                })}
              </div>
            )}
            {cur.type === "saq" && (
              <Input placeholder="Type your answer…" value={picked[0] ?? ""} onChange={(e) => setText(e.target.value)} />
            )}
            {(cur.type === "emq") && parts.map((p, i) => (
              <label key={i} className="grid gap-1 text-sm">
                <span className="font-medium">{i + 1}. {p.stem}</span>
                <Select value={picked[i] ?? ""} onChange={(e) => setPart(i, e.target.value)}>
                  <option value="">Match to…</option>
                  {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                </Select>
              </label>
            ))}
            {cur.type === "matching" && (
              <MatchingInput parts={parts} options={opts} picked={picked} correct={showInstant ? correct : undefined} onAssign={(i, v) => setPart(i, v)} />
            )}
            {(cur.type === "kfq" || cur.type === "compound") && parts.map((p, i) => (
              <label key={i} className="grid gap-1 text-sm">
                <span className="font-medium">{i + 1}. {p.stem}</span>
                <Input placeholder="Your answer…" value={picked[i] ?? ""} onChange={(e) => setPart(i, e.target.value)} />
              </label>
            ))}
            {cur.type === "meq" && parts.slice(0, meqShown[cur.id] ?? 1).map((p, i) => (
              <label key={i} className="grid gap-1 rounded-xl bg-slate-50 p-3 text-sm">
                <span className="font-medium">Step {i + 1}. {p.stem}</span>
                <Input className="bg-white" placeholder="Your answer…" value={picked[i] ?? ""} onChange={(e) => setPart(i, e.target.value)} />
              </label>
            ))}
            {cur.type === "meq" && (meqShown[cur.id] ?? 1) < parts.length && (
              <Button variant="outline" onClick={() => setMeqShown((m) => ({ ...m, [cur.id]: (m[cur.id] ?? 1) + 1 }))}>Reveal step {(meqShown[cur.id] ?? 1) + 1} <ArrowRight className="h-4 w-4" /></Button>
            )}
            {isRubric && (
              <div className="grid gap-2">
                <div className="text-[13px] text-slate-500">Score each criterion honestly — this is self/peer assessment.</div>
                {parts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm">
                    <span className="min-w-0 break-words">{p.label} <span className="text-slate-400">· max {p.max}</span></span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-base hover:bg-slate-50" onClick={() => setCriterion(i, (rScores[i] ?? 0) - 1, Number(p.max) || 0)}>−</button>
                      <span className="w-8 text-center font-bold tabular-nums">{rScores[i] ?? 0}</span>
                      <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-base hover:bg-slate-50" onClick={() => setCriterion(i, (rScores[i] ?? 0) + 1, Number(p.max) || 0)}>+</button>
                    </span>
                  </div>
                ))}
                <div className="text-right text-sm font-semibold">Total {rScores.reduce((s, v) => s + (Number(v) || 0), 0)}/{rubricTotal()} marks</div>
              </div>
            )}
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
            {showInstant && picked.length > 0 && !isFill && !isTheory && !isRubric && !PARTS_Q.includes(cur.type) && cur.type !== "saq" && cur.type !== "sct" && (
              <div className="rounded-lg bg-slate-50 p-3 text-sm">{instantOk ? "Correct. " : `Answer: ${correct.join(", ")}. `}{cur.explanation}</div>
            )}
            {showInstant && (allPartsFilled || (cur.type === "saq" && picked[0]) || (cur.type === "sct" && picked[0])) && (
              <div className="rounded-lg bg-slate-50 p-3 text-sm"><span className="font-medium">{instantOk ? "Correct. " : cur.type === "saq" ? `Accepted: ${correct.join(" / ")}. ` : ""}</span>{cur.explanation}</div>
            )}
            {showInstant && isRubric && (
              <div className="rounded-lg bg-slate-50 p-3 text-sm"><span className="font-medium">Marking guide, compare: </span>{cur.explanation}</div>
            )}
            {showInstant && ((isFill && picked.length > 0 && picked[0]) || (isTheory && picked.length > 0 && picked[0])) && (
              <div className="rounded-lg bg-slate-50 p-3 text-sm"><span className="font-medium">{isTheory ? "Marking guide, compare: " : ""}</span>{cur.explanation}</div>
            )}
            <div className="sticky bottom-3 z-10 mt-1 flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white/95 px-2 py-2 shadow-lift backdrop-blur">
              <Button variant="ghost" size="sm" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Prev</span></Button>
              <Button variant="ghost" size="sm" onClick={() => setFlagged((f) => ({ ...f, [cur.id]: !f[cur.id] }))} className={flagged[cur.id] ? "text-amber-600" : ""}><Flag className="h-4 w-4" /><span className="hidden sm:inline">{flagged[cur.id] ? "Flagged" : "Flag"}</span></Button>
              <span className="min-w-0 flex-1 truncate text-center text-xs tabular-nums text-slate-400">{idx + 1} / {items.length}</span>
              {idx < items.length - 1
                ? <Button size="sm" onClick={() => setIdx((i) => i + 1)}>Next <ArrowRight className="h-4 w-4" /></Button>
                : <Button size="sm" variant="accent" onClick={() => submitAll()}>Finish</Button>}
            </div>
            {idx < items.length - 1 && (
              <Button variant="outline" className="w-full" onClick={() => submitAll()}>Finish round now</Button>
            )}
          </CardContent>
        </Card>
        </div>
      <Card className={`h-fit lg:sticky lg:top-32 ${showPalette ? "" : "hidden lg:block"}`}>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Questions</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap gap-1.5">
            {items.map((q, i) => {
              const done = answers[q.id]?.some((a) => String(a).trim()) || (rubric[q.id]?.some((v) => Number(v) > 0));
              return (
                <button key={q.id} onClick={() => { setIdx(i); setShowPalette(false); }} title={q.stem}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold transition ${i === idx ? "border-slate-900 bg-slate-900 text-white" : done ? "border-green-600 bg-green-50 text-green-900" : "border-slate-200 bg-white hover:border-slate-400"} ${flagged[q.id] ? "ring-2 ring-amber-400" : ""}`}>{i + 1}</button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-slate-900" />Current</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-green-600" />Answered</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-400" />Flagged</span>
          </div>
          <Button size="sm" variant="accent" onClick={() => submitAll()}>Finish round</Button>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

function hintFor(cur: Q, parts: QPart[]): string {
  switch (cur.type) {
    case "multi_select": return "Pick all that apply";
    case "fill_in": return "Type your answer";
    case "saq": return "Concise answer, any accepted wording";
    case "essay": return "Theory, long answer, compare with marking guide";
    case "short_answer": return "Theory, short answer";
    case "mtf": return "Mark each statement True or False";
    case "emq": return "Match each sub-question to the shared list";
    case "matching": return "Drag each choice onto its prompt";
    case "kfq": return "Answer each key question";
    case "meq": return "Steps unfold one at a time";
    case "compound": return "Answer every part";
    case "sct": return "Rate how the new info changes the hypothesis";
    case "osce": case "dops": case "minicex": case "msf": case "viva": return `Examiner checklist · ${parts.reduce((s, p) => s + (Number(p.max) || 0), 0)} marks · self-score honestly`;
    default: return "Pick one";
  }
}

// Activities: mine, added to me, and public — each opens its artifact page
// (banner, contributors, rules gate) with the current mode preselected.
function ActivityPicker({ activities, mode }: {
  activities: { id: string; title: string; banner: string; ownerName: string; questionCount: number; modes: string[]; visibility?: string; category?: string; sector?: string }[];
  mode: string;
}) {
  const bannerBg: Record<string, string> = {
    indigo: "bg-indigo-500", emerald: "bg-emerald-500", amber: "bg-amber-500",
    rose: "bg-rose-500", sky: "bg-sky-500", violet: "bg-violet-500",
  };
  const LADDER = ["primary", "secondary", "tertiary", "professional", "other"];
  const LADDER_LABEL: Record<string, string> = {
    primary: "Primary", secondary: "Secondary", tertiary: "Tertiary",
    professional: "Professional", other: "Other",
  };
  const groups = LADDER.map((c) => ({ cat: c, items: activities.filter((a) => (a.category ?? "tertiary") === c) })).filter((g) => g.items.length);
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-400">Curriculum · {activities.length} activit{activities.length === 1 ? "y" : "ies"}</h2>
        <NewActivityButton variant="outline" size="sm" />
      </div>
      {groups.map((g) => (
        <div key={g.cat} className="grid gap-2">
          <h3 className="flex items-center gap-2 text-[13px] font-bold text-slate-600">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-900 text-[10px] font-black text-white">{LADDER.indexOf(g.cat) + 1}</span>
            {LADDER_LABEL[g.cat]}
          </h3>
          <div className="grid gap-2">
            {g.items.map((a) => (
              <a key={a.id} href={`/archive/${a.id}?mode=${mode}`}
                className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-soft transition hover:shadow-lift">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-black text-white ${bannerBg[a.banner] ?? "bg-indigo-500"}`}>
                  {(a.title.trim().charAt(0) || "A").toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{a.title}</span>
                  <span className="block truncate text-xs text-slate-400">by {a.ownerName} · {a.questionCount} Qs{a.sector ? ` · ${a.sector}` : ""}{a.visibility === "public" ? " · public" : ""}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Drag-and-drop matching: chips from the shared pool onto prompt zones,
// with a select fallback for touch/keyboard.
function MatchingInput({ parts, options, picked, correct, onAssign }: {
  parts: QPart[]; options: string[]; picked: string[]; correct?: string[]; onAssign: (i: number, v: string) => void;
}) {
  const assigned = parts.map((_, i) => picked[i] ?? "");
  const pool = options.filter((o) => !assigned.includes(o));

  function onDropZone(i: number) {
    return (e: React.DragEvent) => {
      e.preventDefault();
      const v = e.dataTransfer.getData("text/plain");
      if (v) onAssign(i, v);
    };
  }

  return (
    <div className="grid gap-2.5">
      <div className="flex flex-wrap gap-1.5 rounded-xl bg-slate-50 p-2.5">
        {pool.length ? pool.map((o) => (
          <span key={o} draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", o); e.dataTransfer.effectAllowed = "move"; }}
            className="flex cursor-grab items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-[13px] font-medium text-indigo-800 shadow-sm active:cursor-grabbing">
            <GripVertical className="h-3.5 w-3.5 text-slate-300" />{o}
          </span>
        )) : <span className="text-[13px] text-slate-400">All choices placed — drag one back here to unassign (or clear its select).</span>}
      </div>
      {parts.map((p, i) => {
        const show = correct && assigned[i];
        const right = correct && assigned[i] === correct[i];
        return (
          <div key={i} onDragOver={(e) => e.preventDefault()} onDrop={onDropZone(i)}
            className={`grid gap-1.5 rounded-xl border-2 border-dashed p-2.5 transition ${show ? (right ? "border-green-400 bg-green-50/50" : "border-red-300 bg-red-50/50") : "border-slate-200"}`}>
            <span className="text-sm font-medium">{i + 1}. {p.stem}</span>
            <div className="flex items-center gap-2">
              <span className={`min-w-24 flex-1 rounded-lg border px-2.5 py-1.5 text-[13px] ${assigned[i] ? "border-indigo-300 bg-indigo-50 font-semibold text-indigo-900" : "border-slate-200 text-slate-400"}`}>
                {assigned[i] || "Drop a choice here…"}
              </span>
              {assigned[i] && <button className="rounded-md px-1.5 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Clear" onClick={() => onAssign(i, "")}>×</button>}
            </div>
            <Select value={assigned[i]} onChange={(e) => onAssign(i, e.target.value)}>
              <option value="">…or pick from the list</option>
              {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          </div>
        );
      })}
    </div>
  );
}
