"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHero, EmptyState } from "@/components/page-hero";
import { Search, BookOpen, ArrowRight } from "lucide-react";

interface Subject { id: string; name: string; description: string; course: string; session: string; topics: number; questionCount: number; }

export default function BankPage() {
  const [all, setAll] = useState<Subject[]>([]);
  const [q, setQ] = useState("");
  const [session, setSession] = useState("");
  useEffect(() => { fetch("/api/subjects").then((r) => r.json()).then(setAll); }, []);
  const sessions = Array.from(new Set(all.map((s) => s.session)));
  const items = all.filter((s) =>
    (!session || s.session === session) &&
    (!q || (s.name + " " + s.description + " " + s.course).toLowerCase().includes(q.toLowerCase()))
  );
  return (
    <div className="grid gap-5">
      <PageHero eyebrow="Question bank" title="Pick a subject" description="Open one to quiz or contribute." />
      <Card><CardContent className="flex flex-wrap gap-2 p-4 sm:p-5">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          <Input className="pl-10" placeholder="Search subjects…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="w-auto" value={session} onChange={(e) => setSession(e.target.value)}>
          <option value="">All sessions</option>{sessions.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </CardContent></Card>
      {items.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((s) => (
            <Card key={s.id} className="group transition hover:shadow-lift">
              <CardHeader>
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600">{s.session} · {s.course}</div>
                <CardTitle className="flex items-center gap-2 text-lg"><BookOpen className="h-4 w-4 text-indigo-600" />{s.name}</CardTitle>
                <CardDescription>{s.description} · {s.topics} topics · {s.questionCount} questions</CardDescription>
              </CardHeader>
              <CardContent>
                <a href={`/bank/subject/${s.id}`}><Button variant="secondary" size="sm" className="opacity-90 group-hover:opacity-100">Open subject <ArrowRight className="h-3.5 w-3.5" /></Button></a>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : <EmptyState title="No subjects found" hint="Clear search or session filter." />}
    </div>
  );
}
