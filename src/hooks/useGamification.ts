import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useCallback } from "react";
import { db } from "../services/firebase";
import { enqueueSync, localDb } from "../services/localDb";
import type { User } from "../types";

export function useGamification(uid?: string) {
  const checkAndUpdateStreak = useCallback(async () => {
    if (!uid) return 0;

    const localUser = await localDb.users.get(uid);
    let user = localUser;

    if (!user && navigator.onLine) {
      const snapshot = await getDoc(doc(db, "users", uid));
      user = snapshot.exists() ? (snapshot.data() as User) : undefined;
    }

    if (!user) return 0;

    const today = toDateKey(new Date());
    const yesterday = toDateKey(addDays(new Date(), -1));
    const lastActiveDate = user.lastActiveDate;
    let nextStreak = user.streakDays ?? 0;

    if (lastActiveDate === today) return nextStreak;
    nextStreak = lastActiveDate === yesterday ? nextStreak + 1 : 1;

    const payload = { streakDays: nextStreak, lastActiveDate: today };
    await localDb.users.update(uid, payload);

    if (navigator.onLine) {
      try {
        await updateDoc(doc(db, "users", uid), payload);
      } catch {
        await enqueueSync({ uid, action: "updateUser", payload });
      }
    } else {
      await enqueueSync({ uid, action: "updateUser", payload });
    }

    return nextStreak;
  }, [uid]);

  return { checkAndUpdateStreak };
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
