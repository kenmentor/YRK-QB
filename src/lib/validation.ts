import { z } from "zod";

// iQueBS v1.0 catalog. Styles group the picker + runner:
// objective (mcq, multi_select, true_false, mtf, sct) | written (fill_in, saq,
// short_answer, essay, compound, meq) | matching (matching, emq, kfq) | rubric
// (osce, dops, minicex, msf, viva — examiner criteria, self/peer-scored in v1).
export const QUESTION_TYPES = [
  "mcq", "multi_select", "true_false", "mtf", "sct",
  "fill_in", "saq", "short_answer", "essay", "compound", "meq",
  "matching", "emq", "kfq",
  "osce", "dops", "minicex", "msf", "viva",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const RUBRIC_TYPES: readonly string[] = ["osce", "dops", "minicex", "msf", "viva"];
// Types whose sub-structure lives in `parts` (aligned with `correct`).
export const PARTS_TYPES: readonly string[] = ["mtf", "emq", "matching", "kfq", "meq", "compound", ...RUBRIC_TYPES];

export const SCT_SCALE = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];

export const CATEGORIES = ["primary", "secondary", "tertiary", "professional", "other"] as const;

export function bandFromIndex(i: number): "easy" | "medium" | "hard" {
  if (i <= 2) return "easy";
  if (i >= 4) return "hard";
  return "medium";
}

// One part: either a sub-question {stem} or a rubric criterion {label, max}.
export const partSchema = z.object({
  stem: z.string().optional(),
  label: z.string().optional(),
  max: z.number().optional(),
});

export type Part = z.infer<typeof partSchema>;

export function parseParts(raw: unknown): Part[] {
  if (Array.isArray(raw)) {
    const p = z.array(partSchema).safeParse(raw);
    return p.success ? p.data : [];
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const arr = JSON.parse(raw);
      const p = z.array(partSchema).safeParse(arr);
      return p.success ? p.data : [];
    } catch { return []; }
  }
  return [];
}

// "a||b" = accepted alternatives for one part/answer.
export function alternatives(s: string): string[] {
  return s.split("||").map((x) => x.trim().toLowerCase()).filter(Boolean);
}

export function matchAny(given: string, expected: string): boolean {
  const g = given.trim().toLowerCase();
  if (!g) return false;
  return alternatives(expected).includes(g);
}

export const questionSchema = z.object({
  type: z.enum(QUESTION_TYPES as unknown as [string, ...string[]]),
  stem: z.string().min(8, "Stem must be at least 8 characters"),
  options: z.array(z.string()),
  correct: z.array(z.string()),
  parts: z.array(partSchema).default([]),
  explanation: z.string().min(4, "Explanation / marking guide is required before review"),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  difficultyIndex: z.number().min(1).max(5).default(3),
  category: z.enum(CATEGORIES as unknown as [string, ...string[]]).default("tertiary"),
  sector: z.string().max(80).default(""),
  tags: z.array(z.string()).default([]),
  imageUrl: z.string().optional(),
  mediaUrl: z.string().max(500).default(""),
}).superRefine((q, ctx) => {
  const issue = (message: string, path: (string | number)[] = ["correct"]) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
  const parts = q.parts ?? [];

  if (q.type === "mcq" && q.correct.length !== 1) issue("MCQ must have exactly one correct answer");
  if (q.type === "mcq" && q.options.length < 2) issue("MCQ needs at least 2 options", ["options"]);
  if (q.type === "multi_select" && q.correct.length < 1) issue("Multi-select needs at least one correct answer");
  if (q.type === "true_false") {
    if (q.options.length !== 2) issue("True/false must have exactly 2 options", ["options"]);
    if (q.correct.length !== 1) issue("True/false must have exactly one correct answer");
  }
  if (q.type === "mtf") {
    if (parts.length < 2) issue("Multiple true/false needs at least 2 statements", ["parts"]);
    if (q.correct.length !== parts.length) issue("Each statement needs a True/False designation");
    if (q.correct.some((c) => c !== "True" && c !== "False")) issue("MTF answers must be True or False");
    if (parts.some((p) => !(p.stem ?? "").trim())) issue("Every MTF statement needs text", ["parts"]);
  }
  if (q.type === "emq" || q.type === "matching") {
    if (!parts.length) issue(`${q.type === "emq" ? "EMQ" : "Matching"} needs at least 1 sub-question`, ["parts"]);
    if (q.options.length < 2) issue("Needs a shared option list of at least 2", ["options"]);
    if (q.correct.length !== parts.length) issue("Each sub-question needs one match");
    if (q.correct.some((c) => !q.options.includes(c))) issue("Every match must come from the shared option list");
  }
  if (q.type === "kfq" || q.type === "meq" || q.type === "compound") {
    if (!parts.length) issue("Needs at least 1 key question / step", ["parts"]);
    if (q.correct.length !== parts.length) issue("Each key question needs an expected answer");
    if (q.correct.some((c) => !c.trim())) issue("Every key question needs an expected answer");
    if (parts.some((p) => !(p.stem ?? "").trim())) issue("Every key question needs text", ["parts"]);
  }
  if (q.type === "saq" && !q.correct.some((c) => c.trim())) issue("SAQ needs at least one accepted answer");
  if (q.type === "sct") {
    if (q.options.length !== SCT_SCALE.length || !SCT_SCALE.every((s, i) => q.options[i] === s))
      issue("Script concordance uses the fixed 5-point scale", ["options"]);
    if (q.correct.length !== 1 || !SCT_SCALE.includes(q.correct[0])) issue("SCT needs the expert panel choice");
  }
  if ((RUBRIC_TYPES as string[]).includes(q.type)) {
    if (!parts.length) issue("Rubric needs at least 1 criterion", ["parts"]);
    if (parts.some((p) => !(p.label ?? "").trim())) issue("Every criterion needs a label", ["parts"]);
    if (parts.some((p) => !(p.max ?? 0) || (p.max ?? 0) <= 0)) issue("Every criterion needs marks above zero", ["parts"]);
  }
  if ((q.type === "essay" || q.type === "short_answer" || q.type === "saq") && q.explanation.length < 10) {
    issue("Written answers need a marking guide / model answer (10+ chars)", ["explanation"]);
  }
});

export type QuestionInput = z.infer<typeof questionSchema>;

export function validateQuestion(input: unknown) {
  return questionSchema.safeParse(input);
}

export function styleOf(type: string): "objective" | "written" | "matching" | "rubric" {
  if ((RUBRIC_TYPES as string[]).includes(type)) return "rubric";
  if (type === "matching" || type === "emq" || type === "kfq") return "matching";
  if (type === "mcq" || type === "multi_select" || type === "true_false" || type === "mtf" || type === "sct") return "objective";
  return "written";
}
