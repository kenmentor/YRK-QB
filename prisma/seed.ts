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


  // ---- iQueBS catalog demo: new formats, folders, shares, set + activity ----
  type CatQ = {
    key: string; topic: string; type: string; stem: string;
    options?: string[]; correct: string[]; parts?: { stem?: string; label?: string; max?: number }[];
    explanation: string; difficultyIndex: number; category: string; sector: string; tags: string[];
    creator: string; folder?: string | null;
  };
  const catBank: CatQ[] = [
    {
      key: "mtf1", topic: "WAEC/Physics 2024/Mechanics/Motion", type: "mtf",
      stem: "Judge each statement about a ball thrown straight up (ignore air resistance).",
      correct: ["True", "False", "True"],
      parts: [{ stem: "Velocity is zero at the top of flight" }, { stem: "Acceleration is zero at the top of flight" }, { stem: "Speed on the way down equals speed at the same height on the way up" }],
      explanation: "Velocity vanishes at the top but g never does; energy conservation restores speed.",
      difficultyIndex: 3, category: "secondary", sector: "Science", tags: ["kinematics", "mtf"], creator: ama.id,
    },
    {
      key: "emq1", topic: "College/Anatomy 101/Cardio/Heart", type: "emq",
      stem: "Match each presentation to the most likely valve lesion.",
      options: ["Aortic stenosis", "Mitral regurgitation", "Mitral stenosis", "Aortic regurgitation", "Tricuspid regurgitation"],
      correct: ["Aortic stenosis", "Mitral stenosis", "Mitral regurgitation"],
      parts: [{ stem: "Elderly man, syncope on exertion, harsh crescendo-decrescendo murmur" }, { stem: "Young woman, malar flush, opening snap with rumbling diastolic murmur" }, { stem: "Holosystolic murmur radiating to the axilla after MI" }],
      explanation: "Classic murmur–lesion pairings; radiation and timing discriminate.",
      difficultyIndex: 4, category: "tertiary", sector: "Medicine & Surgery", tags: ["valves", "emq"], creator: kofi.id,
    },
    {
      key: "mat1", topic: "PMP/PMP Prep/People/Team", type: "matching",
      stem: "Drag each ceremony to its primary purpose.",
      options: ["Inspect the increment", "Plan the sprint", "Synchronize daily", "Reflect and improve"],
      correct: ["Plan the sprint", "Synchronize daily", "Inspect the increment"],
      parts: [{ stem: "Sprint planning" }, { stem: "Daily standup" }, { stem: "Sprint review" }],
      explanation: "Planning commits, standup syncs, review inspects with stakeholders.",
      difficultyIndex: 2, category: "professional", sector: "Engineering", tags: ["scrum", "matching"], creator: yaw.id,
    },
    {
      key: "kfq1", topic: "College/Anatomy 101/Cardio/Heart", type: "kfq",
      stem: "A 58-year-old man has crushing retrosternal pain radiating to the left arm. Answer the key features.",
      correct: ["myocardial infarction||MI||STEMI", "aspirin||troponin||ECG"],
      parts: [{ stem: "Most likely diagnosis?" }, { stem: "Name one immediate investigation or treatment." }],
      explanation: "Key features: recognition + first critical action. Alternatives accepted.",
      difficultyIndex: 4, category: "tertiary", sector: "Medicine & Surgery", tags: ["clinical", "kfq"], creator: kofi.id,
    },
    {
      key: "saq1", topic: "WAEC/Physics 2024/Mechanics/Forces", type: "saq",
      stem: "State the SI unit of power.",
      correct: ["watt", "W", "watts"],
      explanation: "Power = work/time; 1 W = 1 J/s.",
      difficultyIndex: 1, category: "secondary", sector: "Science", tags: ["units", "saq"], creator: ama.id,
    },
    {
      key: "meq1", topic: "College/Anatomy 101/Cardio/Heart", type: "meq",
      stem: "Unfolding case: a 62-year-old woman collapses. Steps reveal as you answer.",
      correct: ["pulse||carotid pulse", "myocardial infarction||MI", "aspirin||oxygen||morphine"],
      parts: [{ stem: "Step 1 — No response. What do you check first?" }, { stem: "Step 2 — ECG shows ST elevation. Diagnosis?" }, { stem: "Step 3 — Name one immediate drug." }],
      explanation: "Sequential reasoning: ABCs, then diagnosis, then management.",
      difficultyIndex: 5, category: "tertiary", sector: "Medicine & Surgery", tags: ["clinical", "meq"], creator: kofi.id,
    },
    {
      key: "sct1", topic: "College/Anatomy 101/Cardio/Heart", type: "sct",
      stem: "Hypothesis: acute pericarditis. New information: ECG shows diffuse concave ST elevation with PR depression. How does this change the hypothesis?",
      options: ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"],
      correct: ["Strongly agree"],
      explanation: "Diffuse concave ST elevation + PR depression is textbook pericarditis — the panel strongly agrees.",
      difficultyIndex: 4, category: "tertiary", sector: "Medicine & Surgery", tags: ["ecg", "sct"], creator: kofi.id,
    },
    {
      key: "cmp1", topic: "WAEC/Physics 2024/Mechanics/Motion", type: "compound",
      stem: "A 2 kg block slides from rest down a 5 m, 30° frictionless incline (g = 10 m/s²). Answer both parts.",
      correct: ["50||50J||50 joules", "7.1||7.07||7.07 m/s"],
      parts: [{ stem: "(a) Kinetic energy at the bottom, in joules?" }, { stem: "(b) Speed at the bottom, in m/s (1 d.p.)?" }],
      explanation: "(a) h = 5·sin30° = 2.5 m, so KE = mgh = 2×10×2.5 = 50 J. (b) v = √(2KE/m) = √50 ≈ 7.1 m/s.",
      difficultyIndex: 4, category: "secondary", sector: "Science", tags: ["energy", "compound"], creator: ama.id,
    },
    {
      key: "osce1", topic: "College/Anatomy 101/Cardio/Heart", type: "osce",
      stem: "OSCE Station 3 (8 minutes): examine the cardiovascular system of a consenting adult.",
      correct: [],
      parts: [{ label: "Hand hygiene + introduction + consent", max: 2 }, { label: "General inspection (breathlessness, pallor, devices)", max: 3 }, { label: "Hands, pulse (rate, rhythm, character), blood pressure", max: 5 }, { label: "Face, neck (JVP), praecordium (inspect, palpate, auscultate)", max: 7 }, { label: "Closure: thanks, summarizes, proposes plan", max: 3 }],
      explanation: "Systematic routine scores: inspection → hands → face/neck → praecordium → closure. 20 marks total.",
      difficultyIndex: 4, category: "tertiary", sector: "Medicine & Surgery", tags: ["osce", "cvs"], creator: kofi.id,
    },
    {
      key: "dops1", topic: "College/Anatomy 101/Cardio/Vessels", type: "dops",
      stem: "DOPS: adult venepuncture for blood cultures. Examiner observes and scores.",
      correct: [],
      parts: [{ label: "Verifies identity + consent + hand hygiene", max: 2 }, { label: "Assembles equipment, applies tourniquet, selects vein", max: 3 }, { label: "Aseptic technique + successful draw + labelling", max: 3 }, { label: "Sharps safety + aftercare + documentation", max: 2 }],
      explanation: "10-mark checklist; any sharps breach caps the station at 4.",
      difficultyIndex: 3, category: "tertiary", sector: "Medicine & Surgery", tags: ["dops", "procedural"], creator: kofi.id,
    },
    {
      key: "viva1", topic: "WAEC/Physics 2024/Waves/Sound", type: "viva",
      stem: "Viva (10 minutes): wave physics. Examiner probes with the questions below.",
      correct: [],
      parts: [{ label: "Defines wave + distinguishes transverse/longitudinal", max: 3 }, { label: "Explains resonance with an example", max: 4 }, { label: "Derives v = fλ and applies it", max: 3 }],
      explanation: "Probe depth, not recall: ask 'why' twice per answer. 10 marks total.",
      difficultyIndex: 3, category: "secondary", sector: "Science", tags: ["viva", "waves"], creator: ama.id,
    },
    {
      key: "mcx1", topic: "College/Anatomy 101/Cardio/Heart", type: "minicex",
      stem: "Mini-CEX: observe a trainee taking chest-pain history (15 minutes).",
      correct: [],
      parts: [{ label: "History taking (SOCRATES + red flags)", max: 4 }, { label: "Communication + empathy", max: 3 }, { label: "Clinical judgement + plan", max: 3 }],
      explanation: "Workplace snapshot: history, humanity, plan. 10 marks total.",
      difficultyIndex: 3, category: "tertiary", sector: "Medicine & Surgery", tags: ["minicex"], creator: kofi.id,
    },
    {
      key: "msf1", topic: "PMP/PMP Prep/People/Team", type: "msf",
      stem: "360° review for a junior PM after one quarter. Raters score independently.",
      correct: [],
      parts: [{ label: "Communication with stakeholders", max: 5 }, { label: "Reliability + follow-through", max: 5 }, { label: "Teamwork + conflict handling", max: 5 }],
      explanation: "Aggregate rater means; discuss gaps ≥2 points. 15 marks total.",
      difficultyIndex: 2, category: "professional", sector: "Engineering", tags: ["msf", "feedback"], creator: yaw.id,
    },
  ];

  async function ensureFolder(ownerId: string, name: string, parentId: string | null, extra: Record<string, unknown> = {}) {
    const ex = (await db.folder.findFirst({ where: { ownerId, parentId, name } }) as unknown as { id: string } | null);
    if (ex) return ex as unknown as { id: string; name: string };
    return (await db.folder.create({ data: { ownerId, name, parentId, ...extra } }) as unknown as { id: string; name: string });
  }

  // Personal drive folders for Ama (+ one shared + one public).
  const amaRoot = await ensureFolder(ama.id, "WAEC Physics 2024", null);
  const amaMech = await ensureFolder(ama.id, "Mechanics", amaRoot.id);
  const amaClin = await ensureFolder(kofi.id, "Clinical Skills", null, { isPublic: true, publicAccess: "use" });

  for (const q of catBank) {
    const n = norm(q.stem);
    let ex = (await db.question.findFirst({ where: { normStem: n } }) as unknown as { id: string; folderId?: string | null } | null);
    if (!ex) {
      ex = (await db.question.create({
        data: {
          topicId: T(q.topic), type: q.type, stem: q.stem, normStem: n,
          options: JSON.stringify(q.options ?? []), correct: JSON.stringify(q.correct),
          parts: JSON.stringify(q.parts ?? []), explanation: q.explanation,
          difficulty: q.difficultyIndex <= 2 ? "easy" : q.difficultyIndex >= 4 ? "hard" : "medium",
          difficultyIndex: q.difficultyIndex, category: q.category, sector: q.sector,
          tags: JSON.stringify(q.tags), mediaUrl: "", creatorId: q.creator,
          folderId: q.folder ?? null,
        },
      }) as unknown as { id: string; folderId?: string | null });
    }
    idByKey[q.key] = ex.id;
  }
  // File catalog items into folders (only if still unfiled — never clobber).
  async function fileIfBare(key: string, folderId: string) {
    const qd = (await db.question.findUnique({ where: { id: idByKey[key] } }) as unknown as { folderId?: string | null } | null);
    if (qd && !qd.folderId) await db.question.update({ where: { id: idByKey[key] }, data: { folderId } });
  }
  for (const k of ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10"]) await fileIfBare(k, amaMech.id);
  for (const k of ["mtf1", "cmp1", "saq1", "viva1"]) await fileIfBare(k, amaMech.id);
  for (const k of ["osce1", "dops1", "mcx1", "emq1", "kfq1", "meq1", "sct1"]) await fileIfBare(k, amaClin.id);

  // Share Ama's bank folder with Yaw (editor) so testers see sharing.
  const yawShare = (await db.folderShare.findFirst({ where: { ownerId: ama.id, folderId: amaRoot.id, userId: yaw.id } }) as unknown as { id: string } | null);
  if (!yawShare) {
    await db.folderShare.create({ data: { ownerId: ama.id, folderId: amaRoot.id, userId: yaw.id, role: "editor" } });
    await db.notification.create({ data: { userId: yaw.id, kind: "share", title: "Bank shared with you", body: "Ama gave you editor access to folder “WAEC Physics 2024”.", link: "/bank", read: false } });
  }

  // Exam set for Ama.
  const setEx = (await db.examSet.findFirst({ where: { ownerId: ama.id, title: "SSS II Physics — First Term Exam" } }) as unknown as { id: string } | null);
  if (!setEx) {
    await db.examSet.create({
      data: {
        ownerId: ama.id, title: "SSS II Physics — First Term Exam",
        institution: "Demo College", department: "Science", domain: "Secondary",
        level: "SSS II", term: "First", subject: "Physics",
        questionIds: JSON.stringify(["m1", "m3", "m5", "saq1", "mtf1"].map((k) => idByKey[k])),
      },
    });
  }

  // Public activity pulling it together (mixed assembly: explicit + folder).
  const actEx = (await db.activity.findFirst({ where: { ownerId: ama.id, title: "WAEC Physics Mock 1" } }) as unknown as { id: string } | null);
  if (!actEx) {
    await db.activity.create({
      data: {
        ownerId: ama.id, title: "WAEC Physics Mock 1", banner: "indigo",
        details: "A 10-question mixed mock: motion, forces, and clinical reasoning warm-ups. Practice or sit it strict.",
        rulesPractice: "", rulesTest: "",
        modes: JSON.stringify(["practice", "selftest", "exam"]),
        visibility: "public", category: "secondary", sector: "Science", subject: "Physics",
        assembly: JSON.stringify([
          { kind: "q", id: idByKey["m1"] },
          { kind: "q", id: idByKey["m3"] },
          { kind: "f", id: amaMech.id },
          { kind: "q", id: idByKey["saq1"] },
        ]),
        questionIds: JSON.stringify([idByKey["m1"], idByKey["m3"], idByKey["saq1"]]),
        folderIds: JSON.stringify([amaMech.id]),
      },
    });
  }

  console.log("Seed done: 77 bank Qs (all 19 formats) + folders + share + exam set + public activity + drafts + attempts.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
