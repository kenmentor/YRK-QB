"use client";
import { useEffect } from "react";

// No landing page: members go to their personal root, visitors to the archive.
export default function Home() {
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { window.location.replace(d.user ? "/bank" : "/archive"); })
      .catch(() => { window.location.replace("/archive"); });
  }, []);
  return (
    <div className="grid place-items-center py-24">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white">Y</span>
        <span className="text-sm text-slate-500 dark:text-[#9aa3b2]">Opening your bank…</span>
      </div>
    </div>
  );
}
