"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHero } from "@/components/page-hero";
import { Play, PlusCircle, ArrowLeft } from "lucide-react";

export default function SubjectPage({ params }: { params: { id: string } }) {
  const [d, setD] = useState<{
    subject: { id: string; name: string; description: string; course: string; session: string };
    topics: { id: string; name: string; description: string; questionCount: number; byType: Record<string, number> }[];
    questionCount: number;
    builders: { id: string; name: string; memberCount: number }[];
    privateCrews: number;
  } | null>(null);
  useEffect(() => { fetch(`/api/subjects/${params.id}`).then((r) => r.json()).then(setD); }, [params.id]);
  if (!d) return <div className="text-sm text-slate-500 dark:text-[#9aa3b2]">Loading subject…</div>;
  return (
    <div className="grid gap-5">
      <PageHero eyebrow={`${d.subject.session} · ${d.subject.course}`} title={d.subject.name}
        description={`${d.subject.description} · ${d.topics.length} topics · ${d.questionCount} atomic questions.`}
        actions={<>
          <a href={`/play?subjectId=${d.subject.id}`} className="w-full sm:w-auto"><Button variant="accent" size="lg" className="w-full sm:w-auto"><Play className="h-4 w-4" /> Start quiz</Button></a>
          <a href={`/bank/subject/${d.subject.id}/contribute`} className="w-full sm:w-auto"><Button variant="secondary" size="lg" className="w-full sm:w-auto"><PlusCircle className="h-4 w-4" /> Contribute a question</Button></a>
        </>} tone="dark" />
      <a href="/bank" className="w-fit"><Button variant="ghost" size="sm"><ArrowLeft className="h-3.5 w-3.5" /> All subjects</Button></a>
      {(!!d.builders.length || !!d.privateCrews) && (
        <Card><CardHeader><CardTitle>Built by crews</CardTitle><CardDescription>Workspaces feeding this subject{d.privateCrews ? `, plus ${d.privateCrews} private ${d.privateCrews === 1 ? "crew" : "crews"}` : ""}.</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {d.builders.map((b) => <span key={b.id} className="rounded-full bg-slate-100 dark:bg-white/[0.07] px-3 py-1.5 text-[13px] font-medium">{b.name} · {b.memberCount}</span>)}
            <a href="/workspaces" className="ml-auto"><Button variant="outline" size="sm">Join a crew</Button></a>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {d.topics.map((t) => (
          <Card key={t.id}><CardHeader><CardTitle className="text-[15px]">{t.name}</CardTitle><CardDescription>{t.description || `${t.questionCount} questions`}</CardDescription></CardHeader>
            <CardContent className="flex flex-wrap items-center gap-1.5">
              <Badge tone="draft">{t.questionCount} Qs</Badge>
              {Object.entries(t.byType).map(([k, v]) => <Badge key={k}>{k.replace("_", " ")} · {v}</Badge>)}
              <a className="ml-auto" href={`/play?subjectId=${d.subject.id}&topicId=${t.id}`}><Button variant="outline" size="sm"><Play className="h-3.5 w-3.5" /> Quiz this topic</Button></a>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
