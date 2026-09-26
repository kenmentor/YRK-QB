"use client";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

const KEY = "yrk-theme";

// Light/dark toggle. Initial theme is painted by a blocking script in the
// root layout (no flash, no hydration mismatch); this only flips after mount.
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {
      /* private mode */
    }
  }

  return (
    <button onClick={toggle} title={dark ? "Light mode" : "Dark mode"} aria-label="Toggle theme"
      className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 dark:text-[#9aa3b2] transition hover:bg-slate-100 dark:hover:bg-white/[0.07] hover:text-slate-900 dark:text-[var(--yrk-text-primary)] dark:text-slate-400 dark:text-[var(--yrk-text-tertiary)] dark:hover:bg-white/[0.07] dark:hover:text-white">
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
