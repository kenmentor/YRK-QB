// Shape guards: bank UIs assume question-ish docs ({ stem, type }) and
// folder-ish docs ({ name }). Anything else (foreign collections, partial
// writes) is filtered server-side and tolerated client-side — never a crash.
export function isBankQuestion(d: unknown): d is { id: string; stem: string; type: string } {
  if (!d || typeof d !== "object") return false;
  const q = d as Record<string, unknown>;
  return typeof q.stem === "string" && typeof q.type === "string";
}

export function isBankFolder(d: unknown): d is { id: string; name: string } {
  if (!d || typeof d !== "object") return false;
  return typeof (d as Record<string, unknown>).name === "string";
}

export function safeArr(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string" && raw.trim()) {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}
