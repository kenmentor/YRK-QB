import { z } from "zod";

// Styles: objective (mcq, multi_select, true_false) | theory (essay, short_answer) | fill (fill_in)
export const questionSchema = z.object({
  type: z.enum(["mcq", "multi_select", "true_false", "fill_in", "essay", "short_answer"]),
  stem: z.string().min(8, "Stem must be at least 8 characters"),
  options: z.array(z.string()),
  correct: z.array(z.string()),
  explanation: z.string().min(4, "Explanation / marking guide is required before review"),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  tags: z.array(z.string()).default([]),
  imageUrl: z.string().optional()
}).superRefine((q, ctx) => {
  if (q.type === "mcq" && q.correct.length !== 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "MCQ must have exactly one correct answer", path: ["correct"] });
  }
  if (q.type === "mcq" && q.options.length < 2) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "MCQ needs at least 2 options", path: ["options"] });
  }
  if (q.type === "multi_select" && q.correct.length < 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Multi-select needs at least one correct answer", path: ["correct"] });
  }
  if (q.type === "true_false") {
    if (q.options.length !== 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "True/false must have exactly 2 options", path: ["options"] });
    }
    if (q.correct.length !== 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "True/false must have exactly one correct answer", path: ["correct"] });
    }
  }
  if ((q.type === "essay" || q.type === "short_answer") && q.explanation.length < 10) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Theory needs a marking guide / model answer (10+ chars)", path: ["explanation"] });
  }
});

export type QuestionInput = z.infer<typeof questionSchema>;

export function validateQuestion(input: unknown) {
  return questionSchema.safeParse(input);
}

export function styleOf(type: string): "objective" | "theory" | "fill" {
  if (type === "essay" || type === "short_answer") return "theory";
  if (type === "fill_in") return "fill";
  return "objective";
}
