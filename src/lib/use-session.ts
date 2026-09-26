"use client";
import { useEffect, useState } from "react";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

let cache: { user: SessionUser | null } | null = null;
let inflight: Promise<{ user: SessionUser | null }> | null = null;

function load(): Promise<{ user: SessionUser | null }> {
  if (!inflight) {
    inflight = fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        cache = { user: (d.user ?? null) as SessionUser | null };
        return cache;
      })
      .catch(() => {
        cache = { user: null };
        return cache;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

// Tri-state session shared across the app: loaded=false renders neutral
// skeletons (never the logged-out UI), so login state never visibly flips.
export function useSession(): { user: SessionUser | null; loaded: boolean } {
  const [s, setS] = useState<{ user: SessionUser | null } | null>(cache);
  useEffect(() => {
    if (cache) {
      setS(cache);
      return;
    }
    let on = true;
    load().then((c) => {
      if (on) setS(c);
    });
    return () => {
      on = false;
    };
  }, []);
  return { user: s?.user ?? null, loaded: s !== null };
}
