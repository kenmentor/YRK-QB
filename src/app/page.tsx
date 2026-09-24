import { Button } from "@/components/ui/button";
import { ArrowRight, GraduationCap, Hammer } from "lucide-react";

export default function Home() {
  return (
    <div className="grid gap-14 py-6 sm:gap-20 sm:py-10">
      {/* Hero, one idea, one door */}
      <section className="mx-auto grid max-w-3xl justify-items-center gap-6 px-2 text-center">
        <div className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 shadow-sm">
          Collaborative exam prep
        </div>
        <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          Build questions together. Ace any exam.
        </h1>
        <p className="max-w-xl text-[16px] leading-relaxed text-slate-500 sm:text-lg">
          One shared bank for WAEC, college, PMP and beyond. First, tell us why you’re here -
          we’ll walk you through, step by step.
        </p>
        <a href="#paths"><Button variant="accent" size="lg">Start here <ArrowRight className="h-4 w-4" /></Button></a>
      </section>

      {/* Procedural split, pick an intent, follow the numbers */}
      <section id="paths" className="mx-auto grid w-full max-w-4xl gap-4 scroll-mt-24 md:grid-cols-2">
        <div className="flex flex-col rounded-3xl bg-slate-900 p-7 text-white shadow-lift sm:p-8">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10"><GraduationCap className="h-5 w-5" /></span>
          <h2 className="mt-4 text-xl font-bold tracking-tight">I’m here to pass</h2>
          <p className="mt-1 text-sm text-slate-400">Your first 10 minutes, in order:</p>
          <ol className="mt-5 grid gap-0">
            {[
              ["Pick your subject", "Find it in the bank, topics, counts and guides included."],
              ["Run a short quiz", "Practice with instant guides, or a timed mock."],
              ["Fix your weak spots", "History groups every miss by topic."]
            ].map(([t, d], i, arr) => (
              <li key={t} className="relative flex gap-4 pb-6 last:pb-0">
                {i < arr.length - 1 && <span className="absolute left-[15px] top-8 h-full w-px bg-white/15" />}
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-[13px] font-bold">{i + 1}</span>
                <div><div className="text-[15px] font-semibold">{t}</div><div className="mt-0.5 text-[13px] leading-relaxed text-slate-400">{d}</div></div>
              </li>
            ))}
          </ol>
          <a href="/bank" className="mt-6"><Button variant="accent" className="w-full">Step 1, pick your subject <ArrowRight className="h-4 w-4" /></Button></a>
        </div>

        <div className="flex flex-col rounded-3xl border border-slate-200/80 bg-white p-7 shadow-soft sm:p-8">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50"><Hammer className="h-5 w-5 text-indigo-600" /></span>
          <h2 className="mt-4 text-xl font-bold tracking-tight">I’m here to build</h2>
          <p className="mt-1 text-sm text-slate-500">Your first contribution, in order:</p>
          <ol className="mt-5 grid gap-0">
            {[
              ["Open a workspace", "Name it, attach it to the ladder, invite 2–3 people."],
              ["Draft with the editor", "Objective, theory or fill-gaps, with live preview."],
              ["Get it approved", "A professor reviews; the owner merges it to the bank."]
            ].map(([t, d], i, arr) => (
              <li key={t} className="relative flex gap-4 pb-6 last:pb-0">
                {i < arr.length - 1 && <span className="absolute left-[15px] top-8 h-full w-px bg-slate-200" />}
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[13px] font-bold text-white">{i + 1}</span>
                <div><div className="text-[15px] font-semibold">{t}</div><div className="mt-0.5 text-[13px] leading-relaxed text-slate-500">{d}</div></div>
              </li>
            ))}
          </ol>
          <a href="/workspaces" className="mt-6"><Button className="w-full">Step 1, open a workspace <ArrowRight className="h-4 w-4" /></Button></a>
        </div>
      </section>

      {/* Quiet reassurance, one line, no decisions */}
      <section className="mx-auto max-w-3xl px-2 text-center text-[13px] leading-relaxed text-slate-400">
        Every bank question is traceable, author, versions, reviews. Every quiz teaches, misses group by topic.
        Free to start, no card required.
      </section>
    </div>
  );
}
