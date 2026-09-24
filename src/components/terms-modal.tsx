"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { TERMS } from "@/lib/terms";

export { TERMS };

export function TermsModal({ onAccept, onClose }: { onAccept: () => void; onClose: () => void }) {
  return (
    <div className="yrk-overlay fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className="yrk-modal max-h-[90dvh] w-full max-w-lg overflow-y-auto shadow-lift"><div onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div><CardTitle>Contribution terms</CardTitle><CardDescription>Read, then OK to proceed, or review the full page.</CardDescription></div>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {TERMS.map((t, i) => <div key={i} className="flex gap-2.5 rounded-xl bg-slate-50 px-3.5 py-2.5"><span className="font-bold text-indigo-600">{i + 1}.</span><span className="text-slate-600">{t}</span></div>)}
          <div className="mt-1 flex flex-wrap gap-2">
            <Button variant="accent" onClick={onAccept}>OK, I accept</Button>
            <a href="/terms" target="_blank"><Button variant="ghost">Full terms page</Button></a>
          </div>
        </CardContent>
      </div></Card>
    </div>
  );
}
