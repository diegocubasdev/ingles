import Dexie, { type Table } from "dexie";
import type {
  PracticeAttempt,
  StudyPlan,
  SyncQueueItem,
  Task,
  User,
} from "../types";

export type LocalTask = Task & { localId?: number; uid: string };

class DevEnglishDb extends Dexie {
  users!: Table<User, string>;
  studyPlans!: Table<StudyPlan, string>;
  tasks!: Table<LocalTask, number>;
  attempts!: Table<PracticeAttempt, string>;
  syncQueue!: Table<SyncQueueItem, number>;

  constructor() {
    super("dev-english-coach");
    this.version(1).stores({
      users: "uid",
      studyPlans: "uid",
      tasks: "++localId, id, uid, day, order, completed, [uid+day]",
      attempts: "id, uid, taskId, createdAt",
      syncQueue: "++id, uid, action, createdAt",
    });
  }
}

export const localDb = new DevEnglishDb();

export async function cacheUser(user: User) {
  await localDb.users.put(user);
  return user;
}

export async function cacheStudyPlan(plan: StudyPlan) {
  await localDb.studyPlans.put(plan);
  return plan;
}

export async function cacheTasks(uid: string, tasks: Task[]) {
  await localDb.transaction("rw", localDb.tasks, async () => {
    for (const task of tasks) {
      const existing = await localDb.tasks
        .where("uid")
        .equals(uid)
        .filter((item) => item.id === task.id)
        .first();

      if (existing?.localId) {
        await localDb.tasks.update(existing.localId, { ...task, uid });
      } else {
        await localDb.tasks.add({ ...task, uid });
      }
    }
  });
}

export async function getLocalTasksForDay(uid: string, day: number) {
  return localDb.tasks
    .where("[uid+day]")
    .equals([uid, day])
    .sortBy("order");
}

export async function enqueueSync(
  item: Omit<SyncQueueItem, "id" | "createdAt" | "attempts">,
) {
  await localDb.syncQueue.add({
    ...item,
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
}
