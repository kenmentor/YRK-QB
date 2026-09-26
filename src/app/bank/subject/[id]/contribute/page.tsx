"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { PageHero } from "@/components/page-hero";
import { QuestionEditor, type QForm } from "@/components/question-editor";
import { TermsModal } from "@/components/terms-modal";
import { toast } from "@/components/ui/toast";
import { CheckCircle2, ArrowLeft, ScrollText } from "lucide-react";

export default function ContributePage({ params }: { params: { id: string } }) {
  const [subject, setSubject] = useState<{ name: string; course: string } | null>(null);
  const [topics, setTopics] = useState<{ id: string; name: string; subject: string; exam: string }[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [note, setNote] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [pending, setPending] = useState<QForm | null>(null);
  const [clears, setClears] = useState(0);

  useEffect(() => {
    fetch(`/api/subjects/${params.id}`).then((r) => r.json()).then((d) => {
      setSubject(d.subject);
      setTopics((d.topics ?? []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name, subject: d.subject.name, exam: d.subject.course })));
    });
  }, [params.id]);

  function onEditorSubmit(f: QForm) {
    if (!accepted) { toast("Read and accept the terms first."); return; }
    if (!f.topicId) { toast("Pick the topic this question belongs to."); return; }
    setPending(f);
    setShowModal(true);
  }

  async function commit() {
    if (!pending) return;
    const res = await fetch(`/api/subjects/${params.id}/proposals`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "new_question", payload: pending, message: note, termsAccepted: true })
    });
    const d = await res.json();
    if (!res.ok) { toast(d.error); setShowModal(false); return; }
    setShowModal(false);
    setPending(null);
    setNote("");
    setClears((c) => c + 1);
    toast("Committed, add another below or track it under My commits.");
  }

  if (!subject) return <div className="text-sm text-slate-500">Loading…</div>;
  return (
    <div className="grid gap-5">
      <PageHero eyebrow={`Contribute · ${subject.course}`} title={`Add to ${subject.name}`} description="Read the terms, craft your question, commit, an admin reviews and commits it to the bank." />
      <a href={`/bank/subject/${params.id}`} className="w-fit"><Button variant="ghost" size="sm"><ArrowLeft className="h-3.5 w-3.5" /> Back to subject</Button></a>

      <Card><CardHeader><CardTitle>Step 1: Terms (tap to read, OK to proceed)</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button variant={accepted ? "secondary" : "default"} onClick={() => setShowTerms(true)}><ScrollText className="h-4 w-4" /> {accepted ? "Terms accepted, read again" : "Read terms"}</Button>
          {accepted
            ? <span className="text-[13px] font-medium text-emerald-700">Accepted, you can commit.</span>
            : <span className="text-[13px] text-slate-400">Nothing commits until you OK the terms.</span>}
          <a href="/terms" target="_blank" className="ml-auto text-[13px] font-medium text-indigo-600 hover:underline">Dedicated terms page</a>
        </CardContent>
      </Card>
      {showTerms && <TermsModal onAccept={() => { setAccepted(true); setShowTerms(false); toast("Terms accepted, craft your question."); }} onClose={() => setShowTerms(false)} />}

      <Card><CardHeader><CardTitle>2 · Your question</CardTitle><CardDescription>Filed under this subject’s topics.</CardDescription></CardHeader>
        <CardContent className="grid gap-3">
          <label className="yrk-label">Note for the admin (optional)<Textarea placeholder="e.g. Verified against 2024 syllabus…" value={note} onChange={(e) => setNote(e.target.value)} /></label>
        </CardContent>
      </Card>
      <QuestionEditor key={clears} topics={topics} submitLabel="Review & commit…" onSubmit={onEditorSubmit} />
      <div className="flex justify-center"><a href="/contributions"><Button variant="ghost" size="sm">See my commits</Button></a></div>

      {showModal && pending && (
        <div className="yrk-sheet yrk-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <Card className="yrk-modal max-h-[90dvh] w-full max-w-md overflow-y-auto shadow-lift"><div onClick={(e) => e.stopPropagation()}>
            <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Commit this question?</CardTitle>
              <CardDescription>An admin will review and commit it to {subject.name}. You’ll get a notification: committed (+message), cancelled with a message, or cancelled with the default note.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3"><div className="font-medium">{pending.stem || "(empty stem)"}</div><div className="text-xs text-slate-500">{pending.type.replace("_", " ")} · {pending.difficulty}</div></div>
              <div className="flex gap-2">
                <Button variant="accent" onClick={commit}>OK, commit for review</Button>
                <Button variant="ghost" onClick={() => setShowModal(false)}>Keep editing</Button>
              </div>
            </CardContent>
          </div></Card>
        </div>
      )}
    </div>
  );
}
