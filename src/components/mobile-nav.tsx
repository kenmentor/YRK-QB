"use client";
import { usePathname } from "next/navigation";
import { Folder, Play, Globe, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/bank", label: "Bank", icon: Folder },
  { href: "/play", label: "Play", icon: Play },
  { href: "/archive", label: "Archive", icon: Globe },
  { href: "/profile", label: "Me", icon: UserRound },
];

// Native bottom tab bar — phones only, safe-area aware. Static links only
// (no session fetch): /profile is guarded server-side and bounces to login,
// so the bar never flickers between states.
export function MobileNav() {
  const path = usePathname();

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/92 backdrop-blur-md md:hidden">
      <div className="grid grid-cols-4 px-2 pt-1.5">
        {TABS.map((t) => {
          const active = !!path && (path === t.href || path.startsWith(t.href + "/"));
          return (
            <a key={t.href} href={t.href}
              className={cn("flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold transition active:scale-95", active ? "text-indigo-600" : "text-slate-400")}>
              <t.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.25 : 1.75} />
              {t.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
