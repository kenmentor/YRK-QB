// Mongo-backed db adapter (Prisma CLI hangs in this env, so runtime uses mongodb driver).
// Keeps the same call shapes as the Prisma version so API routes stay unchanged.
import { ObjectId } from "mongodb";
import { getDb, plain, toPlainList } from "./mongo";

type Where = Record<string, unknown>;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function translateWhere(where: Where = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(where)) {
    if (k === "id" && typeof v === "string") { out._id = safeOid(v); continue; }
    if (k === "id" && v && typeof v === "object" && "in" in (v as Record<string, unknown>)) {
      out._id = { $in: ((v as { in: string[] }).in).map(safeOid).filter(Boolean) };
      continue;
    }
    if (v && typeof v === "object" && "contains" in (v as Record<string, unknown>)) {
      // Escape user input: search is literal text, never a regex program.
      out[k] = { $regex: escapeRegExp((v as { contains: string }).contains), $options: "i" };
      continue;
    }
    if (v && typeof v === "object" && "in" in (v as Record<string, unknown>)) {
      out[k] = { $in: (v as { in: unknown[] }).in };
      continue;
    }
    // *_id string fields -> keep as string (we store FKs as strings for simplicity)
    out[k] = v;
  }
  return out;
}

function safeOid(s: string): ObjectId | string {
  try { return new ObjectId(s); } catch { return s; }
}

function makeModel(name: string) {
  return {
    async findUnique(args: { where: Where }): Promise<any> {
      const db = await getDb();
      const doc = await db.collection(name).findOne(translateWhere(args.where));
      return doc ? plain(doc) : null;
    },
    async findFirst(args: { where: Where }): Promise<any> {
      const db = await getDb();
      const doc = await db.collection(name).findOne(translateWhere(args.where));
      return doc ? plain(doc) : null;
    },
    async findMany(args: { where?: Where; take?: number; skip?: number; orderBy?: Record<string, "asc" | "desc"> } = {}): Promise<any[]> {
      const db = await getDb();
      let cursor = db.collection(name).find(translateWhere(args.where ?? {}));
      if (args.orderBy) {
        const [field, dir] = Object.entries(args.orderBy)[0];
        const sortField = field === "id" ? "_id" : field;
        cursor = cursor.sort({ [sortField]: dir === "desc" ? -1 : 1 });
      } else {
        cursor = cursor.sort({ _id: -1 });
      }
      if (args.skip) cursor = cursor.skip(args.skip);
      if (args.take) cursor = cursor.limit(args.take);
      const docs = await cursor.toArray();
      return toPlainList(docs);
    },
    async create(args: { data: Record<string, unknown> }): Promise<any> {
      const db = await getDb();
      const now = new Date();
      const doc = { ...args.data, createdAt: args.data.createdAt ?? now };
      const res = await db.collection(name).insertOne(doc);
      return plain({ ...doc, _id: res.insertedId });
    },
    async update(args: { where: Where; data: Record<string, unknown> }): Promise<any> {
      const db = await getDb();
      const filter = translateWhere(args.where);
      // unwrap {id} -> _id already handled
      await db.collection(name).updateOne(filter, { $set: { ...args.data, updatedAt: new Date() } });
      const doc = await db.collection(name).findOne(filter);
      return doc ? plain(doc) : null;
    },
    async delete(args: { where: Where }): Promise<any> {
      const db = await getDb();
      const doc = await db.collection(name).findOne(translateWhere(args.where));
      if (doc) await db.collection(name).deleteOne({ _id: doc._id });
      return doc ? plain(doc) : null;
    },
    async deleteMany(args: { where: Where }): Promise<{ count: number }> {
      const db = await getDb();
      const res = await db.collection(name).deleteMany(translateWhere(args.where));
      return { count: res.deletedCount };
    },
    async upsert(args: { where: Where; update: Record<string, unknown>; create: Record<string, unknown> }): Promise<any> {
      const db = await getDb();
      const filter = translateWhere(args.where);
      const existing = await db.collection(name).findOne(filter);
      if (existing) {
        if (Object.keys(args.update).length) {
          await db.collection(name).updateOne(filter, { $set: args.update });
          const doc = await db.collection(name).findOne(filter);
          return doc ? plain(doc) : null;
        }
        return plain(existing);
      }
      const now = new Date();
      const doc = { ...args.create, createdAt: now };
      const res = await db.collection(name).insertOne(doc);
      return plain({ ...doc, _id: res.insertedId });
    }
  };
}

export const db = {
  user: makeModel("users"),
  workspace: makeModel("workspaces"),
  membership: makeModel("memberships"),
  examBody: makeModel("examBodies"),
  exam: makeModel("exams"),
  subject: makeModel("subjects"),
  topic: makeModel("topics"),
  taxonomyProposal: makeModel("taxonomyProposals"),
  question: makeModel("questions"),
  questionDraft: makeModel("questionDrafts"),
  questionVersion: makeModel("questionVersions"),
  review: makeModel("reviews"),
  comment: makeModel("comments"),
  mergeRecord: makeModel("mergeRecords"),
  quizAttempt: makeModel("quizAttempts"),
  attemptAnswer: makeModel("attemptAnswers"),
  folder: makeModel("folders"),
  editApplication: makeModel("editApplications"),
  examSet: makeModel("examSets"),
  folderShare: makeModel("folderShares"),
  activity: makeModel("activities"),
  activityShare: makeModel("activityShares"),
  proposal: makeModel("proposals"),
  notification: makeModel("notifications"),
  joinRequest: makeModel("joinRequests")
};
