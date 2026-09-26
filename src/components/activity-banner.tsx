import { cn } from "@/lib/utils";

export const BANNER_STYLES: Record<string, string> = {
  indigo: "from-brand-600 to-brand-900",
  emerald: "from-emerald-600 to-emerald-900",
  amber: "from-amber-500 to-amber-800",
  rose: "from-rose-600 to-rose-900",
  sky: "from-sky-600 to-sky-900",
  violet: "from-violet-600 to-violet-900",
};

export const BANNERS = Object.keys(BANNER_STYLES);

export function Banner({ preset, title, className }: { preset?: string; title: string; className?: string }) {
  const g = BANNER_STYLES[preset ?? "indigo"] ?? BANNER_STYLES.indigo;
  const initial = (title.trim().charAt(0) || "A").toUpperCase();
  return (
    <div className={cn(`flex h-28 items-center justify-between overflow-hidden bg-gradient-to-br px-5`, g, className)}>
      <span className="text-5xl font-black text-white/90">{initial}</span>
      <span className="grid grid-cols-3 gap-1.5 opacity-30">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="h-6 w-10 rounded-sm bg-white/80" />
        ))}
      </span>
    </div>
  );
}
