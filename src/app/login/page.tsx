"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/use-session";
import { cn } from "@/lib/utils";

const DEFAULT_ACCOUNTS = [
  { name: "Ama", email: "ama@example.com", role: "Learner · bank owner" },
  { name: "Yaw", email: "yaw@example.com", role: "Learner · shared editor" },
  { name: "Prof", email: "prof.akwa@example.com", role: "Reviewer" },
  { name: "Admin", email: "admin@example.com", role: "Admin" },
];

export default function LoginPage() {
  const { user, loaded } = useSession();
  const [email, setEmail] = useState("ama@example.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState<string | null>(null);
  useEffect(() => {
    setNext(new URLSearchParams(window.location.search).get("next"));
  }, []);
  // Already signed in: don't flash the form, leave immediately.
  useEffect(() => {
    if (loaded && user) {
      const params = new URLSearchParams(window.location.search);
      const n = params.get("next");
      window.location.replace(n && n.startsWith("/") ? n : "/");
    }
  }, [loaded, user]);
  async function submit() {
    setError(""); setBusy(true);
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error); return; }
    window.location.href = next && next.startsWith("/") ? next : "/";
  }
  if (!loaded || user) {
    return (
      <div className="mx-auto grid w-full max-w-md gap-3">
        <div className="h-10 w-32 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.07]" />
        <div className="h-64 animate-pulse rounded-3xl bg-slate-100 dark:bg-white/[0.07]" />
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-md">
        <Card><CardHeader><CardTitle>Login</CardTitle><CardDescription>Use a seeded demo or your own account.</CardDescription></CardHeader>
          <CardContent className="grid gap-3">
            {next && <div className="rounded-xl bg-amber-50 dark:bg-amber-950 px-3 py-2 text-[13px] font-medium text-amber-800 dark:text-amber-200">Login to continue.</div>}
            <label className="yrk-label">Email<Input placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="yrk-label">Password<Input placeholder="••••••••" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} /></label>
            {error && <div className="rounded-xl bg-red-50 dark:bg-red-950 px-3 py-2 text-[13px] font-medium text-red-700 dark:text-red-300">{error}</div>}
            <Button onClick={submit} disabled={busy}>{busy ? "Logging in…" : "Login"}</Button>
            <div className="grid gap-1.5">
              <div className="text-center text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-[var(--yrk-text-tertiary)]">Or tap a default account</div>
              <div className="grid grid-cols-2 gap-1.5">
                {DEFAULT_ACCOUNTS.map((a) => (
                  <button key={a.email} onClick={() => { setEmail(a.email); setPassword("password123"); setError(""); }}
                    className={cn("flex items-center gap-2 rounded-xl border border-slate-200 dark:border-[var(--yrk-border-subtle)] px-3 py-2 text-left transition hover:border-slate-300 dark:hover:border-[var(--yrk-border-default)] hover:bg-slate-50 dark:hover:bg-white/[0.05]", email === a.email && "border-brand-500 ring-1 ring-brand-500")}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-black text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{a.name.charAt(0)}</span>
                    <span className="min-w-0"><span className="block truncate text-[13px] font-bold">{a.name}</span>
                    <span className="block truncate text-[11px] text-slate-400 dark:text-[var(--yrk-text-tertiary)]">{a.role}</span></span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
  );
}
