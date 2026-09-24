import { MongoClient, Db, ObjectId } from "mongodb";

const URI = process.env.DATABASE_URL ?? "mongodb://127.0.0.1:27017/yrk-question-bank";
const DB_NAME = URI.split("/").pop()?.split("?")[0] || "yrk-question-bank";

let client: MongoClient | null = null;
let dbRef: Db | null = null;

export async function getDb(): Promise<Db> {
  if (dbRef) return dbRef;
  client = new MongoClient(URI);
  await client.connect();
  dbRef = client.db(DB_NAME);
  return dbRef;
}

export function oid(id?: string): ObjectId | undefined {
  if (!id) return undefined;
  try { return new ObjectId(id); } catch { return undefined; }
}

export function plain<T>(doc: T): T {
  if (!doc || typeof doc !== "object") return doc;
  const d = doc as Record<string, unknown>;
  if (d._id instanceof ObjectId) {
    return { ...d, id: d._id.toHexString() } as unknown as T;
  }
  if (typeof d.id === "string") return doc;
  return doc;
}

export function toPlainList<T>(docs: T[]): T[] {
  return docs.map(plain);
}
