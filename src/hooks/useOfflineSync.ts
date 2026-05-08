import { useCallback, useEffect, useState } from "react";
import { localDb } from "../services/localDb";
import {
  syncCompleteDay,
  syncCompleteTask,
  syncResetPlan,
  syncUserPatch,
} from "../services/studyPlanService";

export function useOfflineSync(uid?: string) {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  const flushQueue = useCallback(async () => {
    if (!uid || !navigator.onLine || syncing) return;

    setSyncing(true);
    try {
      const items = await localDb.syncQueue
        .where("uid")
        .equals(uid)
        .sortBy("createdAt");

      for (const item of items) {
        try {
          if (item.action === "completeTask") {
            await syncCompleteTask(
              item.uid,
              item.payload as { taskId: string; xpAward: number },
            );
          }
          if (item.action === "completeDay") {
            await syncCompleteDay(
              item.uid,
              item.payload as { completedDays: number[]; currentDay: number },
            );
          }
          if (item.action === "updateUser") {
            await syncUserPatch(item.uid, item.payload as Record<string, unknown>);
          }
          if (item.action === "resetPlan") {
            await syncResetPlan(item.uid);
          }

          if (item.id) await localDb.syncQueue.delete(item.id);
        } catch {
          if (item.id) {
            await localDb.syncQueue.update(item.id, {
              attempts: item.attempts + 1,
            });
          }
          break;
        }
      }
    } finally {
      setSyncing(false);
    }
  }, [syncing, uid]);

  useEffect(() => {
    function updateOnlineStatus() {
      setOnline(navigator.onLine);
      if (navigator.onLine) void flushQueue();
    }

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    window.setTimeout(() => void flushQueue(), 0);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, [flushQueue]);

  return { online, syncing, flushQueue };
}
