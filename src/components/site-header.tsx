"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bell, Menu, X, LogOut, UserRound, ShieldCheck, ChevronRight, FileCheck2 } from "lucide-react";

const LINKS = [
  { href: "/bank", label: "Bank" },
  { href: "/play", label: "Play" },
  { href: "/archive", label: "Archive" }
];

function NavLink({ href, label, active, onClick, mobile }: { href: string; label: string; active: boolean; onClick?: () => void; mobile?: boolean }) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={cn(
        "relative font-medium transition",
        mobile
          ? "flex items-center justify-between rounded-xl px-4 py-3.5 text-[15px] hover:bg-slate-100"
          : "rounded-lg px-3 py-2 text-sm",
        active ? "text-slate-900" : "text-slate-500 hover:text-slate-900",
        mobile && active && "bg-slate-100"
      )}
    >
      {label}
      {mobile ? (
        <ChevronRight className="h-4 w-4 text-slate-300" />
      ) : (
        active && <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-indigo-600" />
      )}
    </a>
  );
}

export function SiteHeader() {
  const [user, setUser] = useState<{ email: string; name: string; role: string } | null>(null);
  const [unread, setUnread] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const path = usePathname();

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      setUser(d.user);
      setIsAdmin(d.user?.role === "admin");
    }).catch(() => {});
    fetch("/api/notifications").then((r) => (r.ok ? r.json() : [])).then((list) => setUnread(list.filter((n: { read: boolean }) => !n.read).length)).catch(() => {});
  }, [path]);
  useEffect(() => {
    setMenuOpen(false);
    setUserOpen(false);
  }, [path]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenuOpen(false); setUserOpen(false); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  async function logout() {
    await fetch("/api/auth/me", { method: "POST" });
    setUser(null);
    window.location.href = "/";
  }

  const badge = unread > 0 ? (
    <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold leading-none text-white">
      {unread > 9 ? "9+" : unread}
    </span>
  ) : null;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 sm:px-6">
        <a href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-[15px] font-bold text-white shadow-sm">Y</span>
          <span className="hidden text-[15px] font-bold tracking-tight min-[400px]:block">YRK Question Bank</span>
        </a>

        {/* Desktop nav */}
        <nav className="ml-4 hidden items-center gap-0.5 md:flex">
          {LINKS.map((l) => (
            <NavLink key={l.href} href={l.href} label={l.label} active={!!path?.startsWith(l.href)} />
          ))}
          {isAdmin && <NavLink href="/admin/reviews" label="Reviews" active={!!path?.startsWith("/admin")} />}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          {user ? (
            <>
              <a href="/notifications" title="Notifications"
                className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
                <Bell className="h-5 w-5" />
                {badge}
              </a>
              {/* Desktop identity menu */}
              <div className="relative hidden md:block">
                <button onClick={() => setUserOpen((v) => !v)}
                  className={cn("flex items-center gap-2 rounded-xl border py-1.5 pl-1.5 pr-2.5 shadow-sm transition hover:shadow", userOpen ? "border-slate-300" : "border-slate-200")}>
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-700">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-28 truncate text-[13px] font-semibold">{user.name}</span>
                </button>
                {userOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setUserOpen(false)} />
                    <div className="yrk-modal absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1.5 shadow-lift">
                      <div className="px-4 py-2.5">
                        <div className="truncate text-sm font-semibold">{user.name}</div>
                        <div className="truncate text-xs text-slate-400">{user.email} · {user.role}</div>
                      </div>
                      <div className="border-t border-slate-100 pt-1.5">
                        <a href="/profile" className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"><UserRound className="h-4 w-4" />Profile & progress</a>
                        <a href="/contributions" className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"><FileCheck2 className="h-4 w-4" />My commits</a>
                        {isAdmin && <a href="/admin/reviews" className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"><ShieldCheck className="h-4 w-4" />Review inbox</a>}
                        <button onClick={logout} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"><LogOut className="h-4 w-4" />Logout</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              {/* Mobile hamburger */}
              <button onClick={() => setMenuOpen((v) => !v)} aria-label="Menu"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 md:hidden">
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </>
          ) : (
            <>
              <a href="/login" className="hidden sm:block"><Button variant="ghost" size="sm">Login</Button></a>
              <a href="/register"><Button size="sm">Sign up</Button></a>
              <button onClick={() => setMenuOpen((v) => !v)} aria-label="Menu"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 md:hidden">
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile panel */}
      {menuOpen && (
        <div className="yrk-modal border-t border-slate-100 bg-white px-4 pb-5 pt-2 md:hidden">
          <nav className="grid gap-0.5">
            {LINKS.map((l) => (
              <NavLink key={l.href} mobile href={l.href} label={l.label} active={!!path?.startsWith(l.href)} />
            ))}
            {isAdmin && <NavLink mobile href="/admin/reviews" label="Review inbox" active={!!path?.startsWith("/admin")} />}
            {user ? (
              <>
                <NavLink mobile href="/profile" label="Profile" active={path === "/profile"} />
                <button onClick={logout} className="flex items-center justify-between rounded-xl px-4 py-3.5 text-left text-[15px] font-medium text-red-600 hover:bg-red-50">
                  Logout<LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <a href="/login" className="mt-1"><Button className="w-full" size="lg">Login</Button></a>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
