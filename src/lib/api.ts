import { toast } from "@/components/ui/toast";

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string;
}

function friendly(status: number, fallback: string): string {
  if (status === 0) return "Couldn't reach the server — is it running?";
  return fallback;
}

// fetch() that never rejects: network failure becomes { ok: false }.
// Use for every client call so a dead server shows a toast, never a crash page.
export async function apiGet<T>(url: string): Promise<ApiResult<T>> {
  try {
    const r = await fetch(url);
    const data = (await r.json().catch(() => null)) as T | null;
    if (!r.ok) return { ok: false, status: r.status, data, error: ((data as { error?: string } | null)?.error) ?? "Request failed" };
    return { ok: true, status: r.status, data, error: "" };
  } catch {
    const error = friendly(0, "");
    toast(error);
    return { ok: false, status: 0, data: null, error };
  }
}

export async function apiSend<T>(url: string, method: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await r.json().catch(() => null)) as T | null;
    if (!r.ok) return { ok: false, status: r.status, data, error: ((data as { error?: string } | null)?.error) ?? "Request failed" };
    return { ok: true, status: r.status, data, error: "" };
  } catch {
    const error = friendly(0, "");
    toast(error);
    return { ok: false, status: 0, data: null, error };
  }
}
