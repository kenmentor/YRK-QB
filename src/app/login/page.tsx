"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/use-session";

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
        <div className="h-10 w-32 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-64 animate-pulse rounded-3xl bg-slate-100" />
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-md">
        <Card><CardHeader><CardTitle>Login</CardTitle><CardDescription>Use a seeded demo or your own account.</CardDescription></CardHeader>
          <CardContent className="grid gap-3">
            {next && <div className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] font-medium text-amber-800">Login to continue.</div>}
            <label className="yrk-label">Email<Input placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="yrk-label">Password<Input placeholder="••••••••" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} /></label>
            {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">{error}</div>}
            <Button onClick={submit} disabled={busy}>{busy ? "Logging in…" : "Login"}</Button>
            <div className="text-center text-xs text-slate-500">Demo reviewer login is prefilled — just hit Login.</div>
          </CardContent>
        </Card>
      </div>
  );
}
