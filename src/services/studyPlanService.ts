import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  cacheStudyPlan,
  cacheTasks,
  enqueueSync,
  getLocalTasksForDay,
  localDb,
  type LocalTask,
} from "./localDb";
import type { PlanType, PracticeAttempt, StudyPlan, Task } from "../types";

export async function getCurrentStudyPlan(
  uid: string,
): Promise<StudyPlan | null> {
  const localPlan = await localDb.studyPlans.get(uid);
  if (localPlan) return localPlan;

  const snapshot = await getDoc(doc(db, "users", uid, "studyPlan", "current"));
  if (!snapshot.exists()) return null;

  return cacheStudyPlan(snapshot.data() as StudyPlan);
}

export async function getTasksForDay(uid: string, day: number): Promise<Task[]> {
  const localTasks = await getLocalTasksForDay(uid, day);
  if (localTasks.length > 0) return localTasks.map(stripLocalId);

  const tasksRef = collection(db, "users", uid, "tasks");
  const tasksQuery = query(tasksRef, where("day", "==", day), orderBy("order"));
  const snapshot = await getDocs(tasksQuery);
  const tasks = snapshot.docs.map((taskDoc) => ({
    id: taskDoc.id,
    ...(taskDoc.data() as Omit<Task, "id">),
  }));

  await cacheTasks(uid, tasks);
  return tasks;
}

export async function saveGeneratedPlanLocally({
  uid,
  activePlan,
  totalDays,
  tasks,
}: {
  uid: string;
  activePlan: PlanType;
  totalDays: number;
  tasks: Task[];
}) {
  const now = new Date().toISOString();
  const plan: StudyPlan = {
    uid,
    activePlan,
    totalDays,
    completedDays: [],
    currentDay: 1,
    startedAt: now,
    updatedAt: now,
  };

  await cacheStudyPlan(plan);
  await localDb.tasks.where("uid").equals(uid).delete();
  await cacheTasks(uid, tasks);
  return plan;
}

export async function completeTask(
  uid: string,
  task: Task,
  xpAward: number,
  attempt?: Omit<PracticeAttempt, "id" | "uid" | "taskId" | "taskType" | "createdAt">,
) {
  const completedAt = new Date().toISOString();

  const localTask = await localDb.tasks
    .where("uid")
    .equals(uid)
    .filter((item) => item.id === task.id)
    .first();

  if (localTask?.localId) {
    await localDb.tasks.update(localTask.localId, {
      completed: true,
      xpAward,
      completedAt,
    });
  }

  await localDb.users.where("uid").equals(uid).modify((user) => {
    user.xp = (user.xp ?? 0) + xpAward;
  });

  if (attempt) {
    await localDb.attempts.put({
      id: `${task.id}-${Date.now()}`,
      uid,
      taskId: task.id,
      taskType: task.type,
      transcript: attempt.transcript,
      score: attempt.score,
      correct: attempt.correct,
      createdAt: completedAt,
    });
  }

  const payload = { taskId: task.id, xpAward, completedAt };
  if (!navigator.onLine) {
    await enqueueSync({ uid, action: "completeTask", payload });
    return;
  }

  try {
    await syncCompleteTask(uid, payload);
  } catch {
    await enqueueSync({ uid, action: "completeTask", payload });
  }
}

export async function completeDay(
  uid: string,
  day: number,
  currentCompletedDays: number[],
) {
  const completedDays = Array.from(
    new Set([...currentCompletedDays, day]),
  ).sort((a, b) => a - b);

  const payload = {
    completedDays,
    currentDay: day + 1,
    updatedAt: new Date().toISOString(),
  };

  await localDb.studyPlans.update(uid, payload);

  if (!navigator.onLine) {
    await enqueueSync({ uid, action: "completeDay", payload });
    return;
  }

  try {
    await syncCompleteDay(uid, payload);
  } catch {
    await enqueueSync({ uid, action: "completeDay", payload });
  }
}

export async function deleteStudyPlan(uid: string) {
  await localDb.transaction("rw", localDb.studyPlans, localDb.tasks, async () => {
    await localDb.studyPlans.delete(uid);
    await localDb.tasks.where("uid").equals(uid).delete();
  });

  if (!navigator.onLine) {
    await enqueueSync({ uid, action: "resetPlan", payload: {} });
    return;
  }

  try {
    await deleteDoc(doc(db, "users", uid, "studyPlan", "current"));
  } catch {
    await enqueueSync({ uid, action: "resetPlan", payload: {} });
  }
}

export async function syncCompleteTask(
  uid: string,
  payload: { taskId: string; xpAward: number; completedAt?: string },
) {
  await updateDoc(doc(db, "users", uid, "tasks", payload.taskId), {
    completed: true,
    xpAward: payload.xpAward,
    completedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "users", uid), {
    xp: increment(payload.xpAward),
    updatedAt: serverTimestamp(),
  });
}

export async function syncCompleteDay(
  uid: string,
  payload: { completedDays: number[]; currentDay: number },
) {
  await updateDoc(doc(db, "users", uid, "studyPlan", "current"), {
    completedDays: payload.completedDays,
    currentDay: payload.currentDay,
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "users", uid), { updatedAt: serverTimestamp() });
}

export async function syncUserPatch(uid: string, payload: Record<string, unknown>) {
  await setDoc(
    doc(db, "users", uid),
    { ...payload, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function syncResetPlan(uid: string) {
  await deleteDoc(doc(db, "users", uid, "studyPlan", "current"));
}

function stripLocalId(task: LocalTask): Task {
  const cleanTask = { ...task };
  delete cleanTask.localId;
  return cleanTask;
}
