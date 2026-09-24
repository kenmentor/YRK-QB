"use client";
import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";

export function toast(message: string) {
  window.dispatchEvent(new CustomEvent("yrk-toast", { detail: message }));
}

export function Toaster() {
  useEffect(() => {
    const el = document.getElementById("yrk-toaster");
    const handler = (e: Event) => {
      const msg = (e as CustomEvent).detail as string;
      if (!el) return;
      const div = document.createElement("div");
      div.className = "yrk-toast-in pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-[13px] font-medium leading-snug text-white shadow-lift";
      const dot = document.createElement("span");
      dot.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>';
      dot.style.flexShrink = "0";
      dot.style.marginTop = "1px";
      div.appendChild(dot);
      const span = document.createElement("span");
      span.textContent = msg;
      div.appendChild(span);
      el.appendChild(div);
      setTimeout(() => { div.style.opacity = "0"; div.style.transition = "opacity .3s"; setTimeout(() => div.remove(), 320); }, 4200);
      while (el.children.length > 4) el.firstChild?.remove();
    };
    window.addEventListener("yrk-toast", handler);
    return () => window.removeEventListener("yrk-toast", handler);
  }, []);
  return <div id="yrk-toaster" className="pointer-events-none fixed bottom-4 left-4 right-4 z-[100] grid gap-2 sm:left-auto sm:right-5 sm:w-96" />;
}

export { CheckCircle2 };
