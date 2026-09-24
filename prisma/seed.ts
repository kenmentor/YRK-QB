import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";

function norm(s: string) { return s.trim().toLowerCase().replace(/\s+/g, " "); }

async function upsertUser(email: string, name: string, role: string) {
  const hash = await bcrypt.hash("password123", 10);
  const existing = (await db.user.findUnique({ where: { email } }) as unknown as { id: string } | null);
  if (existing) return (await db.user.update({ where: { id: existing.id }, data: { name, role, password: hash } }) as unknown as { id: string; email: string });
  return (await db.user.create({ data: { email, name, role, password: hash } }) as unknown as { id: string; email: string });
}

type BankQ = { key: string; topicId: string; type: string; stem: string; options: string[]; correct: string[]; explanation: string; difficulty: string; tags: string[] };

async function main() {
  console.log("Seeding users...");
  const prof = (await upsertUser("prof.akwa@example.com", "Prof. Akwa", "professor") as unknown as { id: string });
  const ama = (await upsertUser("ama@example.com", "Ama", "learner") as unknown as { id: string });
  const kojo = (await upsertUser("kojo@example.com", "Kojo", "learner") as unknown as { id: string });
  const sara = (await upsertUser("sara@example.com", "Sara", "learner") as unknown as { id: string });
  const yaw = (await upsertUser("yaw@example.com", "Yaw", "learner") as unknown as { id: string });
  const kofi = (await upsertUser("kofi@example.com", "Kofi", "learner") as unknown as { id: string });
  await upsertUser("admin@example.com", "Admin", "admin");

  const bodies = [
    { name: "WAEC", exams: [{ name: "Physics 2024", subjects: [{ name: "Mechanics", topics: ["Motion", "Forces"] }, { name: "Waves", topics: ["Sound", "Light"] }] }] },
    { name: "PMP", exams: [{ name: "PMP Prep", subjects: [{ name: "People", topics: ["Team", "Stakeholders"] }, { name: "Process", topics: ["Planning", "Risk"] }] }] },
    { name: "College", exams: [{ name: "Anatomy 101", subjects: [{ name: "Cardio", topics: ["Heart", "Vessels"] }] }] }
  ];
  const topicIds: Record<string, string> = {};
  for (const b of bodies) {
    const body = (await db.examBody.upsert({ where: { normName: norm(b.name) }, update: {}, create: { name: b.name, normName: norm(b.name) } }) as unknown as { id: string });
    for (const e of b.exams) {
      let exam = (await db.exam.findFirst({ where: { bodyId: body.id, normName: norm(e.name) } }) as unknown as { id: string } | null);
      if (!exam) exam = (await db.exam.create({ data: { bodyId: body.id, name: e.name, normName: norm(e.name) } }) as unknown as { id: string });
      for (const s of e.subjects) {
        let subj = (await db.subject.findFirst({ where: { examId: exam.id, normName: norm(s.name) } }) as unknown as { id: string } | null);
        if (!subj) subj = (await db.subject.create({ data: { examId: exam.id, name: s.name, normName: norm(s.name) } }) as unknown as { id: string });
        for (const t of s.topics) {
          let topic = (await db.topic.findFirst({ where: { subjectId: subj.id, normName: norm(t) } }) as unknown as { id: string } | null);
          if (!topic) topic = (await db.topic.create({ data: { subjectId: subj.id, name: t, normName: norm(t) } }) as unknown as { id: string });
          topicIds[`${b.name}/${e.name}/${s.name}/${t}`] = topic.id;
        }
      }
    }
  }
  const T = (k: string) => topicIds[k];

  // ---- 4 workspaces in 4 states ----
  async function ensureWs(name: string, focus: string, members: { userId: string; role: string }[]) {
    let ws = (await db.workspace.findFirst({ where: { name } }) as unknown as { id: string } | null);
    if (!ws) ws = (await db.workspace.create({ data: { name, focus } }) as unknown as { id: string });
    for (const m of members) {
      const ex = await db.membership.findFirst({ where: { userId: m.userId, workspaceId: (ws as { id: string }).id } });
      if (!ex) await db.membership.create({ data: { userId: m.userId, workspaceId: (ws as { id: string }).id, role: m.role } });
    }
    return ws as unknown as { id: string };
  }
  const ws1 = await ensureWs("WAEC Physics Crew", "50 questions for WAEC Physics 2024", [
    { userId: ama.id, role: "owner" }, { userId: kojo.id, role: "editor" }, { userId: sara.id, role: "editor" }, { userId: prof.id, role: "reviewer" }
  ]);
  const ws2 = await ensureWs("PMP Study Group", "PMP People + Process bank", [
    { userId: yaw.id, role: "owner" }, { userId: sara.id, role: "editor" }, { userId: prof.id, role: "reviewer" }
  ]);
  const ws3 = await ensureWs("Anatomy Builders", "Cardio draft set, early drafting", [
    { userId: kofi.id, role: "owner" }, { userId: ama.id, role: "editor" }, { userId: prof.id, role: "reviewer" }
  ]);
  const ws4 = await ensureWs("Exam Masters", "Published sets showcase, all merged", [
    { userId: ama.id, role: "owner" }, { userId: yaw.id, role: "editor" }, { userId: prof.id, role: "reviewer" }
  ]);

  // ---- 64-question bank (10 per core topic + extras) ----
  const bank: BankQ[] = [
    // Motion (10)
    { key: "m1", topicId: T("WAEC/Physics 2024/Mechanics/Motion"), type: "mcq", stem: "A car accelerates from 0 to 20 m/s in 5 s. What is its acceleration?", options: ["2 m/s²", "4 m/s²", "5 m/s²", "10 m/s²"], correct: ["4 m/s²"], explanation: "a = Δv/Δt = 20/5 = 4 m/s².", difficulty: "easy", tags: ["kinematics"] },
    { key: "m2", topicId: T("WAEC/Physics 2024/Mechanics/Motion"), type: "mcq", stem: "Which quantity is a vector?", options: ["Speed", "Distance", "Velocity", "Mass"], correct: ["Velocity"], explanation: "Velocity has magnitude and direction.", difficulty: "easy", tags: ["vectors"] },
    { key: "m3", topicId: T("WAEC/Physics 2024/Mechanics/Motion"), type: "mcq", stem: "A ball thrown up at 10 m/s reaches max height? (g=10)", options: ["2.5 m", "5 m", "10 m", "20 m"], correct: ["5 m"], explanation: "h = v²/2g = 100/20 = 5 m.", difficulty: "medium", tags: ["projectile"] },
    { key: "m4", topicId: T("WAEC/Physics 2024/Mechanics/Motion"), type: "true_false", stem: "Displacement can be zero while distance is nonzero.", options: ["True", "False"], correct: ["True"], explanation: "Round trip returns to start.", difficulty: "easy", tags: ["kinematics"] },
    { key: "m5", topicId: T("WAEC/Physics 2024/Mechanics/Motion"), type: "mcq", stem: "Slope of a velocity-time graph gives…", options: ["Displacement", "Acceleration", "Speed", "Jerk"], correct: ["Acceleration"], explanation: "dv/dt = a.", difficulty: "medium", tags: ["graphs"] },
    { key: "m6", topicId: T("WAEC/Physics 2024/Mechanics/Motion"), type: "multi_select", stem: "Select TWO uniform-motion statements.", options: ["a = 0", "v constant", "v changing", "Net force nonzero"], correct: ["a = 0", "v constant"], explanation: "Uniform = no acceleration.", difficulty: "medium", tags: ["kinematics"] },
    { key: "m7", topicId: T("WAEC/Physics 2024/Mechanics/Motion"), type: "mcq", stem: "Free-fall distance after 3 s (g=10, from rest)?", options: ["15 m", "30 m", "45 m", "90 m"], correct: ["45 m"], explanation: "s = ½gt² = 5×9 = 45.", difficulty: "medium", tags: ["free-fall"] },
    { key: "m8", topicId: T("WAEC/Physics 2024/Mechanics/Motion"), type: "fill_in", stem: "Speed = ___ / time.", options: [], correct: ["distance"], explanation: "v = d/t.", difficulty: "easy", tags: ["basics"] },
    { key: "m9", topicId: T("WAEC/Physics 2024/Mechanics/Motion"), type: "mcq", stem: "A 100 m sprinter in 10 s averages…", options: ["5 m/s", "10 m/s", "20 m/s", "100 m/s"], correct: ["10 m/s"], explanation: "100/10 = 10.", difficulty: "easy", tags: ["average"] },
    { key: "m10", topicId: T("WAEC/Physics 2024/Mechanics/Motion"), type: "mcq", stem: "Projectile range is max at…", options: ["30°", "45°", "60°", "90°"], correct: ["45°"], explanation: "R ∝ sin2θ, max at 45°.", difficulty: "hard", tags: ["projectile"] },
    // Forces (10)
    { key: "f1", topicId: T("WAEC/Physics 2024/Mechanics/Forces"), type: "mcq", stem: "A 2 kg mass experiences 10 N. Acceleration?", options: ["2 m/s²", "5 m/s²", "8 m/s²", "20 m/s²"], correct: ["5 m/s²"], explanation: "F=ma → 5.", difficulty: "medium", tags: ["newton"] },
    { key: "f2", topicId: T("WAEC/Physics 2024/Mechanics/Forces"), type: "true_false", stem: "Friction always opposes relative motion.", options: ["True", "False"], correct: ["True"], explanation: "Opposes slip.", difficulty: "easy", tags: ["friction"] },
    { key: "f3", topicId: T("WAEC/Physics 2024/Mechanics/Forces"), type: "mcq", stem: "Weight of 10 kg on Earth (g=10)?", options: ["1 N", "10 N", "100 N", "1000 N"], correct: ["100 N"], explanation: "W=mg.", difficulty: "easy", tags: ["weight"] },
    { key: "f4", topicId: T("WAEC/Physics 2024/Mechanics/Forces"), type: "mcq", stem: "Action-reaction pairs act on…", options: ["Same body", "Different bodies", "Same point", "No bodies"], correct: ["Different bodies"], explanation: "Newton's 3rd law.", difficulty: "medium", tags: ["newton"] },
    { key: "f5", topicId: T("WAEC/Physics 2024/Mechanics/Forces"), type: "multi_select", stem: "Select TWO contact forces.", options: ["Friction", "Normal", "Gravity", "Electrostatic"], correct: ["Friction", "Normal"], explanation: "Contact requires touch.", difficulty: "medium", tags: ["forces"] },
    { key: "f6", topicId: T("WAEC/Physics 2024/Mechanics/Forces"), type: "mcq", stem: "Net force zero means…", options: ["Rest only", "Constant velocity", "Accelerating", "Spinning up"], correct: ["Constant velocity"], explanation: "Equilibrium.", difficulty: "medium", tags: ["equilibrium"] },
    { key: "f7", topicId: T("WAEC/Physics 2024/Mechanics/Forces"), type: "fill_in", stem: "Unit of force is the ___.", options: [], correct: ["newton"], explanation: "SI unit.", difficulty: "easy", tags: ["units"] },
    { key: "f8", topicId: T("WAEC/Physics 2024/Mechanics/Forces"), type: "mcq", stem: "Static friction max is μs × …", options: ["Mass", "Normal", "Velocity", "Area"], correct: ["Normal"], explanation: "fs ≤ μsN.", difficulty: "hard", tags: ["friction"] },
    { key: "f9", topicId: T("WAEC/Physics 2024/Mechanics/Forces"), type: "true_false", stem: "Mass and weight are identical.", options: ["True", "False"], correct: ["False"], explanation: "Mass is inertia; weight is force.", difficulty: "easy", tags: ["basics"] },
    { key: "f10", topicId: T("WAEC/Physics 2024/Mechanics/Forces"), type: "mcq", stem: "Tension in a massless rope is…", options: ["Zero", "Uniform", "Doubled", "Random"], correct: ["Uniform"], explanation: "Ideal rope.", difficulty: "hard", tags: ["tension"] },
    // Sound (8)
    { key: "s1", topicId: T("WAEC/Physics 2024/Waves/Sound"), type: "mcq", stem: "Sound travels fastest in…", options: ["Vacuum", "Air", "Water", "Steel"], correct: ["Steel"], explanation: "Solids transmit fastest.", difficulty: "easy", tags: ["waves"] },
    { key: "s2", topicId: T("WAEC/Physics 2024/Waves/Sound"), type: "mcq", stem: "Frequency unit?", options: ["Volt", "Hertz", "Watt", "Ohm"], correct: ["Hertz"], explanation: "Hz = cycles/s.", difficulty: "easy", tags: ["units"] },
    { key: "s3", topicId: T("WAEC/Physics 2024/Waves/Sound"), type: "true_false", stem: "Ultrasound is above 20 kHz.", options: ["True", "False"], correct: ["True"], explanation: "Human limit ~20 kHz.", difficulty: "medium", tags: ["sound"] },
    { key: "s4", topicId: T("WAEC/Physics 2024/Waves/Sound"), type: "mcq", stem: "Echo is caused by…", options: ["Refraction", "Reflection", "Diffraction", "Absorption"], correct: ["Reflection"], explanation: "Bounced wave.", difficulty: "easy", tags: ["echo"] },
    { key: "s5", topicId: T("WAEC/Physics 2024/Waves/Sound"), type: "multi_select", stem: "Select TWO wave properties.", options: ["Amplitude", "Charge", "Wavelength", "Mass"], correct: ["Amplitude", "Wavelength"], explanation: "Wave descriptors.", difficulty: "medium", tags: ["waves"] },
    { key: "s6", topicId: T("WAEC/Physics 2024/Waves/Sound"), type: "fill_in", stem: "Loudness unit is the ___.", options: [], correct: ["decibel"], explanation: "dB scale.", difficulty: "medium", tags: ["units"] },
    { key: "s7", topicId: T("WAEC/Physics 2024/Waves/Sound"), type: "mcq", stem: "Resonance occurs when driving freq…", options: ["Differs", "Matches natural", "Is zero", "Is random"], correct: ["Matches natural"], explanation: "Energy transfer max.", difficulty: "hard", tags: ["resonance"] },
    { key: "s8", topicId: T("WAEC/Physics 2024/Waves/Sound"), type: "mcq", stem: "Doppler shift rises when source…", options: ["Recedes", "Approaches", "Stops", "Cools"], correct: ["Approaches"], explanation: "Waves compress.", difficulty: "medium", tags: ["doppler"] },
    // Team (10)
    { key: "t1", topicId: T("PMP/PMP Prep/People/Team"), type: "mcq", stem: "A servant leader primarily…", options: ["Commands", "Removes impediments", "Avoids conflict", "Controls scope"], correct: ["Removes impediments"], explanation: "Unblocks team.", difficulty: "medium", tags: ["agile"] },
    { key: "t2", topicId: T("PMP/PMP Prep/People/Team"), type: "multi_select", stem: "Select TWO charter ground rules.", options: ["Start on time", "Blame loudly", "Respect WIP limits", "Skip retros"], correct: ["Start on time", "Respect WIP limits"], explanation: "Norms + flow.", difficulty: "medium", tags: ["team"] },
    { key: "t3", topicId: T("PMP/PMP Prep/People/Team"), type: "mcq", stem: "Tuckman stage after storming?", options: ["Forming", "Norming", "Adjourning", "Planning"], correct: ["Norming"], explanation: "Form-storm-norm-perform.", difficulty: "easy", tags: ["tuckman"] },
    { key: "t4", topicId: T("PMP/PMP Prep/People/Team"), type: "true_false", stem: "Colocated teams never need charters.", options: ["True", "False"], correct: ["False"], explanation: "Charters align all.", difficulty: "easy", tags: ["team"] },
    { key: "t5", topicId: T("PMP/PMP Prep/People/Team"), type: "mcq", stem: "Best conflict technique for lasting buy-in?", options: ["Smooth", "Force", "Collaborate", "Withdraw"], correct: ["Collaborate"], explanation: "Win-win.", difficulty: "hard", tags: ["conflict"] },
    { key: "t6", topicId: T("PMP/PMP Prep/People/Team"), type: "mcq", stem: "Emotional intelligence starts with…", options: ["Empathy", "Self-awareness", "Social skills", "Motivation"], correct: ["Self-awareness"], explanation: "Know thyself first.", difficulty: "medium", tags: ["ei"] },
    { key: "t7", topicId: T("PMP/PMP Prep/People/Team"), type: "fill_in", stem: "A ___ charter lists values and norms.", options: [], correct: ["team"], explanation: "Team charter.", difficulty: "easy", tags: ["team"] },
    { key: "t8", topicId: T("PMP/PMP Prep/People/Team"), type: "mcq", stem: "Daily standup timebox?", options: ["5 min", "15 min", "1 hr", "2 hrs"], correct: ["15 min"], explanation: "Short sync.", difficulty: "easy", tags: ["agile"] },
    { key: "t9", topicId: T("PMP/PMP Prep/People/Team"), type: "multi_select", stem: "Select TWO psychological-safety behaviors.", options: ["Blameless retros", "Invite dissent", "Punish mistakes", "Hide risks"], correct: ["Blameless retros", "Invite dissent"], explanation: "Safety first.", difficulty: "hard", tags: ["safety"] },
    { key: "t10", topicId: T("PMP/PMP Prep/People/Team"), type: "mcq", stem: "Sprint review demos to…", options: ["Team only", "Stakeholders", "No one", "Sponsor only"], correct: ["Stakeholders"], explanation: "Feedback loop.", difficulty: "medium", tags: ["scrum"] },
    // Stakeholders (8)
    { key: "st1", topicId: T("PMP/PMP Prep/People/Stakeholders"), type: "mcq", stem: "Power/interest grid: high-power low-interest →", options: ["Manage closely", "Keep satisfied", "Monitor", "Inform"], correct: ["Keep satisfied"], explanation: "Classic grid.", difficulty: "medium", tags: ["stakeholder"] },
    { key: "st2", topicId: T("PMP/PMP Prep/People/Stakeholders"), type: "true_false", stem: "Stakeholders include only sponsors.", options: ["True", "False"], correct: ["False"], explanation: "Anyone affected.", difficulty: "easy", tags: ["stakeholder"] },
    { key: "st3", topicId: T("PMP/PMP Prep/People/Stakeholders"), type: "mcq", stem: "Engagement assessment matrix tracks…", options: ["Cost", "Current vs desired engagement", "Risk scores", "Dates"], correct: ["Current vs desired engagement"], explanation: "Unaware→leading.", difficulty: "hard", tags: ["engagement"] },
    { key: "st4", topicId: T("PMP/PMP Prep/People/Stakeholders"), type: "fill_in", stem: "A ___ register lists stakeholders.", options: [], correct: ["stakeholder"], explanation: "Register.", difficulty: "easy", tags: ["stakeholder"] },
    { key: "st5", topicId: T("PMP/PMP Prep/People/Stakeholders"), type: "mcq", stem: "Early stakeholder identification avoids…", options: ["Scope creep", "Quality", "Safety", "Lunch"], correct: ["Scope creep"], explanation: "Expectations set early.", difficulty: "medium", tags: ["scope"] },
    { key: "st6", topicId: T("PMP/PMP Prep/People/Stakeholders"), type: "multi_select", stem: "Select TWO comm channels.", options: ["Push", "Pull", "Shove", "Hide"], correct: ["Push", "Pull"], explanation: "Push vs pull.", difficulty: "medium", tags: ["comms"] },
    { key: "st7", topicId: T("PMP/PMP Prep/People/Stakeholders"), type: "mcq", stem: "Salience model adds…", options: ["Legitimacy", "Budget", "Velocity", "Humor"], correct: ["Legitimacy"], explanation: "Power-legitimacy-urgency.", difficulty: "hard", tags: ["salience"] },
    { key: "st8", topicId: T("PMP/PMP Prep/People/Stakeholders"), type: "mcq", stem: "Best kickoff outcome?", options: ["Aligned expectations", "Free food", "Long slides", "No questions"], correct: ["Aligned expectations"], explanation: "Alignment.", difficulty: "easy", tags: ["kickoff"] },
    // Heart (10)
    { key: "h1", topicId: T("College/Anatomy 101/Cardio/Heart"), type: "mcq", stem: "The mitral valve separates…", options: ["RA/RV", "LA/LV", "LV/Aorta", "RV/PA"], correct: ["LA/LV"], explanation: "Left atrium → ventricle.", difficulty: "hard", tags: ["valves"] },
    { key: "h2", topicId: T("College/Anatomy 101/Cardio/Heart"), type: "fill_in", stem: "Cardiac output = ___ × stroke volume.", options: [], correct: ["heart rate"], explanation: "CO = HR × SV.", difficulty: "medium", tags: ["physio"] },
    { key: "h3", topicId: T("College/Anatomy 101/Cardio/Heart"), type: "mcq", stem: "SA node is in the…", options: ["Left ventricle", "Right atrium", "Aorta", "Septum"], correct: ["Right atrium"], explanation: "Pacemaker.", difficulty: "medium", tags: ["conduction"] },
    { key: "h4", topicId: T("College/Anatomy 101/Cardio/Heart"), type: "true_false", stem: "The left ventricle wall is thickest.", options: ["True", "False"], correct: ["True"], explanation: "Systemic pressure.", difficulty: "easy", tags: ["anatomy"] },
    { key: "h5", topicId: T("College/Anatomy 101/Cardio/Heart"), type: "mcq", stem: "Coronary arteries branch from…", options: ["Pulmonary trunk", "Aorta", "SVC", "Carotid"], correct: ["Aorta"], explanation: "Aortic sinuses.", difficulty: "hard", tags: ["coronary"] },
    { key: "h6", topicId: T("College/Anatomy 101/Cardio/Heart"), type: "multi_select", stem: "Select TWO systemic-circuit vessels.", options: ["Aorta", "Vena cava", "Pulmonary vein", "Pulmonary artery"], correct: ["Aorta", "Vena cava"], explanation: "Systemic loop.", difficulty: "medium", tags: ["circuits"] },
    { key: "h7", topicId: T("College/Anatomy 101/Cardio/Heart"), type: "mcq", stem: "Diastole is…", options: ["Contraction", "Relaxation", "Fibrillation", "Arrest"], correct: ["Relaxation"], explanation: "Filling phase.", difficulty: "easy", tags: ["cycle"] },
    { key: "h8", topicId: T("College/Anatomy 101/Cardio/Heart"), type: "fill_in", stem: "The ___ valve guards the aortic outlet.", options: [], correct: ["aortic"], explanation: "Aortic valve.", difficulty: "medium", tags: ["valves"] },
    { key: "h9", topicId: T("College/Anatomy 101/Cardio/Heart"), type: "mcq", stem: "ECG QRS reflects…", options: ["Atrial depol", "Ventricular depol", "Repolarization", "Rest"], correct: ["Ventricular depol"], explanation: "QRS = ventricles.", difficulty: "hard", tags: ["ecg"] },
    { key: "h10", topicId: T("College/Anatomy 101/Cardio/Heart"), type: "mcq", stem: "Pericardium function?", options: ["Pump", "Protect + lubricate", "Conduct", "Filter"], correct: ["Protect + lubricate"], explanation: "Sac around heart.", difficulty: "easy", tags: ["anatomy"] },
    // Vessels + Planning + Risk + Light extras (8)
    { key: "v1", topicId: T("College/Anatomy 101/Cardio/Vessels"), type: "mcq", stem: "Largest artery?", options: ["Carotid", "Aorta", "Femoral", "Radial"], correct: ["Aorta"], explanation: "Biggest.", difficulty: "easy", tags: ["vessels"] },
    { key: "v2", topicId: T("College/Anatomy 101/Cardio/Vessels"), type: "true_false", stem: "Veins carry only deoxygenated blood.", options: ["True", "False"], correct: ["False"], explanation: "Pulmonary veins carry O2.", difficulty: "medium", tags: ["vessels"] },
    { key: "p1", topicId: T("PMP/PMP Prep/Process/Planning"), type: "mcq", stem: "WBS decomposes…", options: ["Schedule", "Scope", "Cost", "Risk"], correct: ["Scope"], explanation: "Work breakdown.", difficulty: "medium", tags: ["planning"] },
    { key: "p2", topicId: T("PMP/PMP Prep/Process/Planning"), type: "fill_in", stem: "Critical path has ___ float.", options: [], correct: ["zero"], explanation: "Zero slack.", difficulty: "hard", tags: ["schedule"] },
    { key: "r1", topicId: T("PMP/PMP Prep/Process/Risk"), type: "mcq", stem: "Risk matrix plots…", options: ["Cost/schedule", "Probability/impact", "Scope/time", "Team/size"], correct: ["Probability/impact"], explanation: "PxI.", difficulty: "medium", tags: ["risk"] },
    { key: "r2", topicId: T("PMP/PMP Prep/Process/Risk"), type: "multi_select", stem: "Select TWO risk responses.", options: ["Mitigate", "Accept", "Ignore silently", "Blame"], correct: ["Mitigate", "Accept"], explanation: "PMBOK responses.", difficulty: "medium", tags: ["risk"] },
    { key: "l1", topicId: T("WAEC/Physics 2024/Waves/Light"), type: "mcq", stem: "Light bends at interface: …", options: ["Reflection", "Refraction", "Absorption", "Polarization"], correct: ["Refraction"], explanation: "Snell's law.", difficulty: "easy", tags: ["optics"] },
    { key: "l2", topicId: T("WAEC/Physics 2024/Waves/Light"), type: "true_false", stem: "Blue light refracts more than red in glass.", options: ["True", "False"], correct: ["True"], explanation: "Dispersion.", difficulty: "hard", tags: ["optics"] }
  ];

  const idByKey: Record<string, string> = {};
  let qi = 0;
  for (const q of bank) {
    const n = norm(q.stem);
    let ex = (await db.question.findFirst({ where: { normStem: n } }) as unknown as { id: string } | null);
    if (!ex) {
      // creator by topic family; every 5th open for edit applications
      const low = q.stem.toLowerCase();
      let creator = ama.id;
      if (low.includes("servant") || low.includes("charter") || low.includes("tuckman") || low.includes("stakeholder") || low.includes("wbs") || low.includes("risk") || low.includes("critical") || low.includes("sprint") || low.includes("standup")) creator = yaw.id;
      else if (low.includes("mitral") || low.includes("cardiac") || low.includes("arter") || low.includes("vein") || low.includes("aorta") || low.includes("valve") || low.includes("heart") || low.includes("sa node") || low.includes("diastole") || low.includes("ecg") || low.includes("pericardium")) creator = kofi.id;
      ex = (await db.question.create({ data: { topicId: q.topicId, type: q.type, stem: q.stem, normStem: n, options: JSON.stringify(q.options), correct: JSON.stringify(q.correct), explanation: q.explanation, difficulty: q.difficulty, tags: JSON.stringify(q.tags), creatorId: creator, allowApplications: qi % 5 === 0 } }) as unknown as { id: string });
    }
    idByKey[q.key] = ex.id;
    qi++;
  }

  // ---- duplicate pair for merge demo (canonical + alias) ----
  const dupStem = "Which quantity is a vector?";
  const canonical = (await db.question.findFirst({ where: { normStem: norm(dupStem) } }) as unknown as { id: string });
  const dupCopy = (await db.question.create({ data: { topicId: T("WAEC/Physics 2024/Mechanics/Motion"), type: "mcq", stem: "Which of these is a vector quantity?", normStem: norm("Which of these is a vector quantity?"), options: JSON.stringify(["Speed", "Distance", "Velocity", "Mass"]), correct: JSON.stringify(["Velocity"]), explanation: "Duplicate of vector Q.", difficulty: "easy", tags: JSON.stringify(["duplicate-demo"]) } }) as unknown as { id: string });
  await db.question.update({ where: { id: dupCopy.id }, data: { mergedIntoId: canonical.id } });
  await db.mergeRecord.create({ data: { workspaceId: ws1.id, type: "deduplicate", sourceIds: JSON.stringify([dupCopy.id]), targetIds: JSON.stringify([canonical.id]), actorId: prof.id } });

  // ---- drafts in 4 states ----
  async function mkDraft(wsId: string, authorId: string, stem: string, status: string, extra: Partial<Record<string, string>> = {}) {
    const d = (await db.questionDraft.create({ data: { workspaceId: wsId, authorId, topicId: T("WAEC/Physics 2024/Mechanics/Motion"), type: "mcq", stem, options: JSON.stringify(["A", "B", "C", "D"]), correct: JSON.stringify(["B"]), explanation: "Seeded draft.", difficulty: "medium", tags: JSON.stringify(["seeded"]), status, ...extra } }) as unknown as { id: string });
    await db.questionVersion.create({ data: { draftId: d.id, authorId, stem: "v1", options: "[]", correct: "[]", explanation: "", note: "initial" } });
    await db.questionVersion.create({ data: { draftId: d.id, authorId, stem, options: JSON.stringify(["A", "B", "C", "D"]), correct: JSON.stringify(["B"]), explanation: "Seeded draft.", note: "edit" } });
    return d;
  }
  const d1 = await mkDraft(ws1.id, kojo.id, "A ball is thrown up at 10 m/s. Max height? (g=10)", "approved");
  await db.comment.create({ data: { draftId: d1.id, authorId: sara.id, body: "Nice one, check units." } });
  await db.review.create({ data: { draftId: d1.id, reviewerId: prof.id, verdict: "approved", comment: "This is good, commit." } });
  const d2 = await mkDraft(ws1.id, sara.id, "Slope of displacement-time graph gives…", "in_review");
  await db.comment.create({ data: { draftId: d2.id, authorId: kojo.id, body: "Should we add a diagram?" } });
  const d3 = await mkDraft(ws3.id, kofi.id, "SA node is located in the…", "draft");
  await db.comment.create({ data: { draftId: d3.id, authorId: ama.id, body: "Add explanation before review." } });
  const d4 = await mkDraft(ws2.id, sara.id, "Sprint review demos to…", "approved");
  await db.review.create({ data: { draftId: d4.id, reviewerId: prof.id, verdict: "approved", comment: "Good, merge it." } });
  await db.mergeRecord.create({ data: { workspaceId: ws2.id, type: "approve_to_live", sourceIds: JSON.stringify([d4.id]), targetIds: JSON.stringify([idByKey["t10"]]), actorId: yaw.id } });
  await db.mergeRecord.create({ data: { workspaceId: ws4.id, type: "set_publish", sourceIds: JSON.stringify([d1.id, d4.id]), targetIds: JSON.stringify([idByKey["m3"], idByKey["t10"]]), actorId: ama.id } });

  // ---- taxonomy curation queue ----
  await db.taxonomyProposal.create({ data: { kind: "topic", parentId: "mechanics", name: "physics", normName: "physics", status: "pending" } });
  await db.taxonomyProposal.create({ data: { kind: "topic", parentId: "mechanics", name: "Thermodynamics", normName: "thermodynamics", status: "pending" } });

  // ---- 15 attempts with spread ----
  const users = [ama.id, kojo.id, sara.id, yaw.id, kofi.id];
  const qids = Object.values(idByKey);
  const keyList = Object.keys(idByKey);
  for (let i = 0; i < 15; i++) {
    const uid = users[i % users.length];
    const slice = qids.slice((i * 3) % qids.length, ((i * 3) % qids.length) + 5);
    const mode = i % 3 === 0 ? "exam" : "practice";
    let score = 0;
    const attempt = (await db.quizAttempt.create({ data: { userId: uid, mode, filter: JSON.stringify({ demo: true }), score: 0, total: slice.length } }) as unknown as { id: string });
    for (let j = 0; j < slice.length; j++) {
      const qid = slice[j];
      const bankQ = bank.find((b) => idByKey[b.key] === qid);
      const answeredRight = (i + j) % 3 !== 0;
      const given = answeredRight ? bankQ?.correct ?? ["x"] : ["__wrong__"];
      if (answeredRight) score++;
      await db.attemptAnswer.create({ data: { attemptId: attempt.id, questionId: qid, given: JSON.stringify(given), correct: answeredRight } });
      void keyList;
    }
    await db.quizAttempt.update({ where: { id: attempt.id }, data: { score, total: slice.length } });
  }

  console.log("Seed done: 64 bank Qs + dup pair + 4 drafts + 2 proposals + 15 attempts.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
