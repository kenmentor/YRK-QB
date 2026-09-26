// Wire shapes mirror src/app/api/drive/export/route.ts structurally
// (never import the route — it drags the DB driver into the client).
export interface WireQuestion {
  format: "yrk-question/1";
  type: string;
  stem: string;
  options: string[];
  correct: string[];
  parts: { stem?: string; label?: string; max?: number }[];
  explanation: string;
  difficultyIndex: number;
  category: string;
  sector: string;
  tags: string[];
  mediaUrl: string;
  topicPath: string[] | null;
}

export interface WireFolder {
  format: "yrk-folder/1";
  name: string;
  folders: WireFolder[];
  questions: WireQuestion[];
}

function slug(s: string, fallback: string): string {
  const c = s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return c || fallback;
}

export function downloadBlob(name: string, content: Blob | string, mime: string) {
  const blob = typeof content === "string" ? new Blob([content], { type: mime }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadQuestionFile(q: {
  type: string; stem: string; options: string; correct: string; parts?: string;
  explanation: string; difficultyIndex?: number; difficulty: string;
  category?: string; sector?: string; tags?: string; mediaUrl?: string;
}) {
  const js = (raw?: string, fb: unknown[] = []) => {
    try { const v = raw ? JSON.parse(raw) : fb; return Array.isArray(v) ? v : fb; } catch { return fb; }
  };
  const doc: WireQuestion = {
    format: "yrk-question/1",
    type: q.type,
    stem: q.stem,
    options: js(q.options),
    correct: js(q.correct),
    parts: js(q.parts),
    explanation: q.explanation,
    difficultyIndex: q.difficultyIndex ?? 3,
    category: q.category ?? "tertiary",
    sector: q.sector ?? "",
    tags: js(q.tags),
    mediaUrl: q.mediaUrl ?? "",
    topicPath: null,
  };
  downloadBlob(`${slug(q.stem, "question")}.json`, JSON.stringify(doc, null, 2), "application/json");
}

// Build a real folder (.zip): <name>/folder.json + q-NN.json + subfolders.
export async function downloadFolderZip(bundle: WireFolder) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  let n = 0;
  function addDir(dir: { file: (name: string, data: string) => void; folder: (name: string) => unknown }, node: WireFolder) {
    const d = dir as { file: (name: string, data: string) => void; folder: (name: string) => { file: (name: string, data: string) => void; folder: (name: string) => unknown } | null };
    d.file("folder.json", JSON.stringify({ format: "yrk-folder/1", name: node.name }, null, 2));
    for (const qd of node.questions) {
      n++;
      const file = `${String(n).padStart(2, "0")}-${slug(qd.stem, "question")}-${qd.type}.json`;
      d.file(file, JSON.stringify({ ...qd, format: "yrk-question/1" } as WireQuestion, null, 2));
    }
    for (const sub of node.folders) {
      const kid = d.folder(slug(sub.name, "folder"));
      if (kid) addDir(kid, sub);
    }
  }
  const root = zip.folder(slug(bundle.name, "bank"));
  if (root) addDir(root, bundle);
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(`${slug(bundle.name, "bank")}.zip`, blob, "application/zip");
}

export interface ParsedImport {
  bundle: WireFolder;
  folders: number;
  questions: number;
  errors: string[];
}

// Parse a picked file (.zip or .json, incl. hand-written) into a bundle.
export async function parseImportFile(file: File): Promise<ParsedImport> {
  const errors: string[] = [];
  if (/\.zip$/i.test(file.name)) {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(file);
    const rootName = file.name.replace(/\.zip$/i, "");
    const root: WireFolder = { format: "yrk-folder/1", name: rootName, folders: [], questions: [] };
    const dirMap = new Map<string, WireFolder>([["", root]]);
    const entries: string[] = [];
    zip.forEach((path) => { if (!path.endsWith("/")) entries.push(path); });
    entries.sort();
    for (const path of entries) {
      const parts = path.split("/").filter(Boolean);
      if (!parts.length) continue;
      // Drop the top-level dir if the zip wraps everything in one folder.
      const rel = parts.length > 1 && entries.every((e) => e.split("/").filter(Boolean)[0] === parts[0]) ? parts.slice(1) : parts;
      if (!rel.length) continue;
      const fname = rel[rel.length - 1];
      const dirParts = rel.slice(0, -1);
      let node = root;
      let prefix = "";
      for (const dp of dirParts) {
        prefix += (prefix ? "/" : "") + dp;
        if (!dirMap.has(prefix)) {
          const kid: WireFolder = { format: "yrk-folder/1", name: dp, folders: [], questions: [] };
          node.folders.push(kid);
          dirMap.set(prefix, kid);
        }
        node = dirMap.get(prefix)!;
      }
      if (/^folder\.json$/i.test(fname)) {
        try {
          const txt = await zip.file(path)!.async("string");
          const man = JSON.parse(txt);
          if (man?.name) node.name = String(man.name).slice(0, 80);
        } catch { errors.push(`${path}: bad folder.json`); }
        continue;
      }
      if (!/\.json$/i.test(fname)) continue;
      try {
        const txt = await zip.file(path)!.async("string");
        const qd = JSON.parse(txt);
        if (!qd || typeof qd !== "object" || qd.format !== "yrk-question/1") {
          errors.push(`${path}: not a yrk-question/1 file`);
          continue;
        }
        node.questions.push(qd as WireQuestion);
      } catch {
        errors.push(`${path}: unreadable JSON`);
      }
    }
    // Unwrap single top-level wrapper dir for a clean name.
    const bundle = root.folders.length === 1 && !root.questions.length ? root.folders[0] : root;
    if (bundle === root) root.name = rootName;
    return { bundle, ...countBundle(bundle), errors };
  }
  const txt = await file.text();
  let doc: unknown;
  try {
    doc = JSON.parse(txt);
  } catch {
    return { bundle: { format: "yrk-folder/1", name: "import", folders: [], questions: [] }, folders: 0, questions: 0, errors: ["Not valid JSON"] };
  }
  const d = doc as { format?: string };
  if (d.format === "yrk-question/1") {
    const bundle: WireFolder = { format: "yrk-folder/1", name: "imported-questions", folders: [], questions: [doc as WireQuestion] };
    return { bundle, ...countBundle(bundle), errors };
  }
  if (d.format === "yrk-folder/1") {
    const bundle = doc as WireFolder;
    return { bundle, ...countBundle(bundle), errors };
  }
  return { bundle: { format: "yrk-folder/1", name: "import", folders: [], questions: [] }, folders: 0, questions: 0, errors: ["Unknown format tag (want yrk-folder/1 or yrk-question/1)"] };
}

export function countBundle(b: WireFolder): { folders: number; questions: number } {
  let folders = 0;
  let questions = b.questions.length;
  for (const f of b.folders) {
    folders++;
    const c = countBundle(f);
    folders += c.folders;
    questions += c.questions;
  }
  return { folders, questions };
}

export const SAMPLE_BUNDLE: WireFolder = {
  format: "yrk-folder/1",
  name: "Sample Bank",
  folders: [
    {
      format: "yrk-folder/1",
      name: "Mechanics",
      folders: [],
      questions: [
        {
          format: "yrk-question/1",
          type: "mcq",
          stem: "A car accelerates from 0 to 20 m/s in 5 s. What is its acceleration?",
          options: ["2 m/s²", "4 m/s²", "5 m/s²", "10 m/s²"],
          correct: ["4 m/s²"],
          parts: [],
          explanation: "a = Δv/Δt = 20/5 = 4 m/s².",
          difficultyIndex: 2,
          category: "secondary",
          sector: "Physics",
          tags: ["kinematics"],
          mediaUrl: "",
          topicPath: null,
        },
      ],
    },
  ],
  questions: [],
};
