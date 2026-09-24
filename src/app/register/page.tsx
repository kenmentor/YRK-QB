"use client";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("learner");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setError(""); setBusy(true);
    const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, name, password, role }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Failed"); return; }
    window.location.href = "/";
  }
  return (
    <div className="mx-auto w-full max-w-md">
        <Card><CardHeader><CardTitle>Sign up</CardTitle><CardDescription>Free to start.</CardDescription></CardHeader>
          <CardContent className="grid gap-3">
            <label className="yrk-label">Full name<Input placeholder="Ama Serwaa" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="yrk-label">Email<Input placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="yrk-label">Password (min 6)<Input placeholder="••••••••" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <label className="yrk-label">I’m joining as
              <Select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="learner">Learner, take quizzes</option>
                <option value="professor">Professor, review & approve</option>
              </Select>
            </label>
            {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">{error}</div>}
            <Button onClick={submit} disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
            <div className="text-center text-xs text-slate-500">Have an account? <a className="font-semibold text-indigo-600 hover:underline" href="/login">Login</a></div>
          </CardContent>
        </Card>
      </div>
  );
}
