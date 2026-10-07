"use client";
import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";

export type ToastKind = "ok" | "err" | "info";

export function toast(message: string, kind: ToastKind = "ok") {
  window.dispatchEvent(new CustomEvent("yrk-toast", { detail: { message, kind } }));
}

const KIND_STYLE: Record<ToastKind, { border: string; icon: string }> = {
  ok: {
    border: "border-slate-800 dark:border-white/15",
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>',
  },
  err: {
    border: "border-red-500 dark:border-red-500",
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>',
  },
  info: {
    border: "border-slate-600 dark:border-white/25",
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  },
};

export function Toaster() {
  useEffect(() => {
    const el = document.getElementById("yrk-toaster");
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { message: string; kind?: ToastKind } | string;
      const msg = typeof detail === "string" ? detail : detail.message;
      const kind: ToastKind = (typeof detail === "object" && detail.kind) || "ok";
      if (!el) return;
      const div = document.createElement("div");
      const title = kind === "err" ? "Error" : kind === "info" ? "Notice" : "Done";
      div.setAttribute("role", kind === "err" ? "alert" : "status");
      div.className = `yrk-toast-in pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-2xl border bg-slate-900 px-4 py-3 text-[13px] font-medium leading-snug text-white shadow-lift ${KIND_STYLE[kind].border}`;
      if (kind === "err") div.style.background = "#1c0f14";
      const dot = document.createElement("span");
      dot.setAttribute("aria-hidden", "true");
      dot.title = title;
      dot.innerHTML = KIND_STYLE[kind].icon;
      dot.style.flexShrink = "0";
      dot.style.marginTop = "1px";
      div.appendChild(dot);
      const span = document.createElement("span");
      span.textContent = msg;
      div.appendChild(span);
      el.appendChild(div);
      setTimeout(() => { div.style.opacity = "0"; div.style.transition = "opacity .3s"; setTimeout(() => div.remove(), 320); }, kind === "err" ? 6000 : 4200);
      while (el.children.length > 4) el.firstChild?.remove();
    };
    window.addEventListener("yrk-toast", handler);
    return () => window.removeEventListener("yrk-toast", handler);
  }, []);
  return <div id="yrk-toaster" className="pointer-events-none fixed bottom-24 left-4 right-4 z-[100] grid gap-2 sm:left-auto sm:right-5 sm:w-96 sm:bottom-5" />;
}

export { CheckCircle2 };
