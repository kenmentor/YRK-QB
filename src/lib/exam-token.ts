import crypto from "node:crypto";

// Server-only exam session tokens. Binds snapshot + clock server-side so
// exam answers never ship to the browser and timers can't be forged.
// Practice mode doesn't use tokens (instant feedback needs the answers).
export interface ExamTicket {
  ids: string[];
  topicId?: string;
  subjectId?: string;
  startedAt: number;
  durationSecs: number;
}

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET must be set in production");
  return "dev-only-throwaway-secret-not-for-production";
}

function b64url(s: string): string {
  return Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s: string): string {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
}

export function signTicket(t: ExamTicket): string {
  const body = b64url(JSON.stringify(t));
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("hex");
  return `${body}.${sig}`;
}

export function verifyTicket(token: string): ExamTicket | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const expect = crypto.createHmac("sha256", secret()).update(body).digest("hex");
    if (sig.length !== expect.length) return null;
    let ok = true;
    for (let i = 0; i < sig.length; i++) if (sig[i] !== expect[i]) ok = false;
    if (!ok) return null;
    return JSON.parse(unb64url(body)) as ExamTicket;
  } catch {
    return null;
  }
}
