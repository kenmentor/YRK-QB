// Demo seed: a small mixed bank for local try-outs.
// NOTE (2026-10-07): reconstructed after the working tree was reset to HEAD
// and the untracked original was lost. Entries below match the original's
// question set; wiring (demo user + Demo topic) is best-effort. Verify before
// trusting it for anything important.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function band(i: number): string {
  return i <= 2 ? "easy" : i >= 4 ? "hard" : "medium";
}

type DemoQ = {
  key: string; type: string; stem: string; options?: string[]; correct: string[];
  parts?: { stem?: string; label?: string; max?: number }[];
  explanation: string; difficultyIndex: number; category: string; sector: string; tags: string[];
};

const SCT = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];

const QUESTIONS: DemoQ[] = [
  { key: "m1", type: "mcq", stem: "A car accelerates from 0 to 20 m/s in 5 s. What is its acceleration?", options: ["2 m/s²", "4 m/s²", "5 m/s²", "10 m/s²"], correct: ["4 m/s²"], explanation: "a = Δv/Δt = 20/5 = 4 m/s².", difficultyIndex: 2, category: "secondary", sector: "Science", tags: ["kinematics"] },
  { key: "m2", type: "mcq", stem: "Which quantity is a vector?", options: ["Speed", "Distance", "Velocity", "Mass"], correct: ["Velocity"], explanation: "Velocity has magnitude and direction.", difficultyIndex: 1, category: "secondary", sector: "Science", tags: ["vectors"] },
  { key: "m3", type: "mcq", stem: "A ball thrown up at 10 m/s reaches max height? (g=10)", options: ["2.5 m", "5 m", "10 m", "20 m"], correct: ["5 m"], explanation: "h = v²/2g = 100/20 = 5 m.", difficultyIndex: 3, category: "secondary", sector: "Science", tags: ["projectile"] },
  { key: "m5", type: "mcq", stem: "Slope of a velocity-time graph gives…", options: ["Displacement", "Acceleration", "Speed", "Jerk"], correct: ["Acceleration"], explanation: "dv/dt = a.", difficultyIndex: 3, category: "secondary", sector: "Science", tags: ["graphs"] },
  { key: "m10", type: "mcq", stem: "Projectile range is max at…", options: ["30°", "45°", "60°", "90°"], correct: ["45°"], explanation: "R ∝ sin2θ, max at 45°.", difficultyIndex: 4, category: "secondary", sector: "Science", tags: ["projectile"] },
  { key: "f1", type: "mcq", stem: "A 2 kg mass experiences 10 N. Acceleration?", options: ["2 m/s²", "5 m/s²", "8 m/s²", "20 m/s²"], correct: ["5 m/s²"], explanation: "F=ma → a = 10/2 = 5.", difficultyIndex: 3, category: "secondary", sector: "Science", tags: ["newton"] },
  { key: "f3", type: "mcq", stem: "Weight of 10 kg on Earth (g=10)?", options: ["1 N", "10 N", "100 N", "1000 N"], correct: ["100 N"], explanation: "W = mg = 100 N.", difficultyIndex: 1, category: "secondary", sector: "Science", tags: ["weight"] },
  { key: "s1", type: "mcq", stem: "Sound travels fastest in…", options: ["Vacuum", "Air", "Water", "Steel"], correct: ["Steel"], explanation: "Solids transmit sound fastest.", difficultyIndex: 1, category: "secondary", sector: "Science", tags: ["waves"] },
  { key: "m4", type: "true_false", stem: "Displacement can be zero while distance is nonzero.", options: ["True", "False"], correct: ["True"], explanation: "A round trip returns to the start.", difficultyIndex: 1, category: "secondary", sector: "Science", tags: ["kinematics"] },
  { key: "f2", type: "true_false", stem: "Friction always opposes relative motion.", options: ["True", "False"], correct: ["True"], explanation: "Friction opposes slip.", difficultyIndex: 1, category: "secondary", sector: "Science", tags: ["friction"] },
  { key: "m6", type: "multi_select", stem: "Select TWO uniform-motion statements.", options: ["a = 0", "v constant", "v changing", "Net force nonzero"], correct: ["a = 0", "v constant"], explanation: "Uniform motion means no acceleration.", difficultyIndex: 3, category: "secondary", sector: "Science", tags: ["kinematics"] },
  { key: "emq1", type: "emq", stem: "Match each presentation to the most likely valve lesion.", options: ["Aortic stenosis", "Mitral regurgitation", "Mitral stenosis", "Aortic regurgitation", "Tricuspid regurgitation"], correct: ["Aortic stenosis", "Mitral stenosis", "Mitral regurgitation"], parts: [{ stem: "Elderly man, syncope on exertion, harsh crescendo-decrescendo murmur" }, { stem: "Young woman, malar flush, opening snap, rumbling diastolic murmur" }, { stem: "Holosystolic murmur radiating to the axilla after MI" }], explanation: "Classic murmur–lesion pairings.", difficultyIndex: 4, category: "tertiary", sector: "Medicine & Surgery", tags: ["emq"] },
  { key: "mat1", type: "matching", stem: "Drag each ceremony to its primary purpose.", options: ["Inspect the increment", "Plan the sprint", "Synchronize daily", "Reflect and improve"], correct: ["Plan the sprint", "Synchronize daily", "Inspect the increment"], parts: [{ stem: "Sprint planning" }, { stem: "Daily standup" }, { stem: "Sprint review" }], explanation: "Planning commits, standup syncs, review inspects.", difficultyIndex: 2, category: "professional", sector: "Engineering", tags: ["matching"] },
  { key: "sct1", type: "sct", stem: "Hypothesis: acute pericarditis. New info: ECG shows diffuse concave ST elevation with PR depression. How does this change the hypothesis?", options: SCT, correct: ["Strongly agree"], explanation: "Textbook pericarditis pattern — panel strongly agrees.", difficultyIndex: 4, category: "tertiary", sector: "Medicine & Surgery", tags: ["sct"] },
];

async function main() {
  console.log("Seeding demo user + topic...");
  const hash = await bcrypt.hash("password123", 10);
  let demo = (await db.user.findUnique({ where: { email: "demo@example.com" } }) as unknown as { id: string } | null);
  if (!demo) demo = (await db.user.create({ data: { email: "demo@example.com", name: "Demo", role: "professor", password: hash } }) as unknown as { id: string });

  const body = (await db.examBody.upsert({ where: { normName: norm("Demo") }, update: {}, create: { name: "Demo", normName: norm("Demo") } }) as unknown as { id: string });
  let exam = (await db.exam.findFirst({ where: { bodyId: body.id, normName: norm("Demo Bank") } }) as unknown as { id: string } | null);
  if (!exam) exam = (await db.exam.create({ data: { bodyId: body.id, name: "Demo Bank", normName: norm("Demo Bank") } }) as unknown as { id: string });
  let subject = (await db.subject.findFirst({ where: { examId: exam.id, normName: norm("General") } }) as unknown as { id: string } | null);
  if (!subject) subject = (await db.subject.create({ data: { examId: exam.id, name: "General", normName: norm("General") } }) as unknown as { id: string });
  let topic = (await db.topic.findFirst({ where: { subjectId: subject.id, normName: norm("Mixed") } }) as unknown as { id: string } | null);
  if (!topic) topic = (await db.topic.create({ data: { subjectId: subject.id, name: "Mixed", normName: norm("Mixed") } }) as unknown as { id: string });

  console.log(`Seeding ${QUESTIONS.length} demo questions...`);
  let created = 0;
  for (const q of QUESTIONS) {
    const existing = await db.question.findFirst({ where: { normStem: norm(q.stem) } });
    if (existing) continue;
    await db.question.create({
      data: {
        topicId: topic.id,
        type: q.type,
        stem: q.stem,
        normStem: norm(q.stem),
        options: JSON.stringify(q.options ?? []), correct: JSON.stringify(q.correct),
        parts: JSON.stringify(q.parts ?? []),
        explanation: q.explanation,
        difficulty: band(q.difficultyIndex),
        difficultyIndex: q.difficultyIndex,
        marks: null,
        category: q.category,
        sector: q.sector,
        tags: JSON.stringify(q.tags),
        creatorId: demo.id,
        folderId: null,
      },
    });
    created++;
  }
  console.log(`Done. ${created} new demo questions (rest already present).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
