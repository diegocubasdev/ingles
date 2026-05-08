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
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type { StudyPlan, Task } from "../types";

export async function getCurrentStudyPlan(
  uid: string,
): Promise<StudyPlan | null> {
  const snapshot = await getDoc(doc(db, "users", uid, "studyPlan", "current"));
  return snapshot.exists() ? (snapshot.data() as StudyPlan) : null;
}

export async function getTasksForDay(
  uid: string,
  day: number,
): Promise<Task[]> {
  const tasksRef = collection(db, "users", uid, "tasks");
  const tasksQuery = query(tasksRef, where("day", "==", day), orderBy("order"));
  const snapshot = await getDocs(tasksQuery);

  return snapshot.docs.map((taskDoc) => ({
    id: taskDoc.id,
    ...(taskDoc.data() as Omit<Task, "id">),
  }));
}

export async function completeTask(uid: string, task: Task, xpAward: number) {
  await updateDoc(doc(db, "users", uid, "tasks", task.id), {
    completed: true,
    xpAward,
    completedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "users", uid), {
    xp: increment(xpAward),
    updatedAt: serverTimestamp(),
  });
}

export async function completeDay(
  uid: string,
  day: number,
  currentCompletedDays: number[],
) {
  const completedDays = Array.from(
    new Set([...currentCompletedDays, day]),
  ).sort((a, b) => a - b);

  await updateDoc(doc(db, "users", uid, "studyPlan", "current"), {
    completedDays,
    currentDay: day + 1,
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "users", uid), { updatedAt: serverTimestamp() });
}

export async function deleteStudyPlan(uid: string) {
  await deleteDoc(doc(db, "users", uid, "studyPlan", "current"));
}
