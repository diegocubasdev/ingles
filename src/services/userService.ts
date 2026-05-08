import {
  GoogleAuthProvider,
  linkWithPopup,
  linkWithRedirect,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, authPersistenceReady, db } from "./firebase";
import { deleteStudyPlan } from "./studyPlanService";
import { cacheUser, enqueueSync, localDb } from "./localDb";
import type { TechStack, User } from "../types";

const defaultUser = (uid: string): User => ({
  uid,
  name: "Student",
  currentLevel: "A1",
  techStack: null,
  xp: 0,
  streakDays: 0,
  lastActiveDate: null,
  activePlan: null,
  planStartDate: null,
});

function createGoogleProvider() {
  const provider = new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: "select_account",
  });

  return provider;
}

function isPwaStandalone() {
  const isStandaloneDisplay = window.matchMedia?.(
    "(display-mode: standalone)",
  ).matches;

  const isIosStandalone =
    "standalone" in window.navigator &&
    Boolean(
      (window.navigator as Navigator & { standalone?: boolean }).standalone,
    );

  return Boolean(isStandaloneDisplay || isIosStandalone);
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function shouldFallbackToRedirect(error: unknown) {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "";

  return [
    "auth/popup-blocked",
    "auth/popup-closed-by-user",
    "auth/cancelled-popup-request",
    "auth/operation-not-supported-in-this-environment",
  ].includes(code);
}

export async function waitForAuthUser() {
  await authPersistenceReady;

  return new Promise<NonNullable<typeof auth.currentUser> | null>(
    (resolve, reject) => {
      const unsubscribe = onAuthStateChanged(
        auth,
        (firebaseUser) => {
          unsubscribe();
          resolve(firebaseUser);
        },
        reject,
      );
    },
  );
}

export async function getOrCreateUser(): Promise<User> {
  const firebaseUser = await waitForAuthUser();

  if (!firebaseUser) {
    throw new Error("User not authenticated");
  }

  const displayName = firebaseUser.displayName ?? undefined;
  const localUser = await localDb.users.get(firebaseUser.uid);

  if (!navigator.onLine && localUser) {
    return localUser;
  }

  const ref = doc(db, "users", firebaseUser.uid);
  let snapshot;

  try {
    snapshot = await getDoc(ref);
  } catch {
    if (localUser) return localUser;
    const user: User = {
      ...defaultUser(firebaseUser.uid),
      name: displayName ?? "Student",
    };
    await cacheUser(user);
    await enqueueSync({ uid: user.uid, action: "updateUser", payload: user });
    return user;
  }

  if (snapshot.exists()) {
    const user = {
      ...defaultUser(firebaseUser.uid),
      ...(snapshot.data() as User),
      techStack: (snapshot.data() as Partial<User>).techStack ?? null,
    };

    if (displayName && user.name !== displayName) {
      await setDoc(
        ref,
        {
          name: displayName,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      return cacheUser({
        ...user,
        name: displayName,
      });
    }

    return cacheUser(user);
  }

  const user: User = {
    ...defaultUser(firebaseUser.uid),
    name: displayName ?? "Student",
  };

  try {
    await setDoc(ref, {
      ...user,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    await enqueueSync({ uid: user.uid, action: "updateUser", payload: user });
  }

  return cacheUser(user);
}

export async function signInWithGoogle(): Promise<User | void> {
  await authPersistenceReady;

  const provider = createGoogleProvider();
  const avoidRedirect = isPwaStandalone() && isIosDevice();

  if (auth.currentUser?.isAnonymous) {
    try {
      await linkWithPopup(auth.currentUser, provider);
      return getOrCreateUser();
    } catch (error) {
      console.warn("Popup link failed:", error);

      if (shouldFallbackToRedirect(error) && !avoidRedirect) {
        await linkWithRedirect(auth.currentUser, provider);
        return;
      }

      throw error;
    }
  }

  try {
    await signInWithPopup(auth, provider);
    return getOrCreateUser();
  } catch (error) {
    console.warn("Popup sign-in failed:", error);

    if (shouldFallbackToRedirect(error) && !avoidRedirect) {
      await signInWithRedirect(auth, provider);
      return;
    }

    throw error;
  }
}

export function getAuthUser() {
  return auth.currentUser;
}

export async function getUser(uid: string): Promise<User | null> {
  const snapshot = await getDoc(doc(db, "users", uid));

  return snapshot.exists() ? (snapshot.data() as User) : null;
}

export async function resetPlan(uid: string): Promise<void> {
  await localDb.users.update(uid, {
    activePlan: null,
    planStartDate: null,
  });

  if (navigator.onLine) {
    try {
      await updateDoc(doc(db, "users", uid), {
        activePlan: null,
        planStartDate: null,
        updatedAt: serverTimestamp(),
      });
    } catch {
      await enqueueSync({
        uid,
        action: "updateUser",
        payload: { activePlan: null, planStartDate: null },
      });
    }
  } else {
    await enqueueSync({
      uid,
      action: "updateUser",
      payload: { activePlan: null, planStartDate: null },
    });
  }

  await deleteStudyPlan(uid);
}

export async function updateUserTechStack(uid: string, techStack: TechStack) {
  const payload = { techStack };
  await localDb.users.update(uid, payload);

  if (!navigator.onLine) {
    await enqueueSync({ uid, action: "updateUser", payload });
    return;
  }

  try {
    await setDoc(
      doc(db, "users", uid),
      { ...payload, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch {
    await enqueueSync({ uid, action: "updateUser", payload });
  }
}

export function timestampToDate(value: User["planStartDate"]) {
  if (!value) return null;
  if (typeof value === "string") return new Date(value);
  return value.toDate();
}
