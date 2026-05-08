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
  type Timestamp,
} from "firebase/firestore";
import { auth, authPersistenceReady, db } from "./firebase";
import { deleteStudyPlan } from "./studyPlanService";
import type { User } from "../types";

const defaultUser = (uid: string): User => ({
  uid,
  name: "Student",
  currentLevel: "A1",
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
  const ref = doc(db, "users", firebaseUser.uid);
  const snapshot = await getDoc(ref);

  if (snapshot.exists()) {
    const user = snapshot.data() as User;

    if (displayName && user.name !== displayName) {
      await setDoc(
        ref,
        {
          name: displayName,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      return {
        ...user,
        name: displayName,
      };
    }

    return user;
  }

  const user: User = {
    ...defaultUser(firebaseUser.uid),
    name: displayName ?? "Student",
  };

  await setDoc(ref, {
    ...user,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return user;
}

export async function signInWithGoogle(): Promise<User | void> {
  await authPersistenceReady;

  const provider = createGoogleProvider();
  const useRedirectDirectly = isPwaStandalone();

  if (auth.currentUser?.isAnonymous) {
    if (useRedirectDirectly) {
      await linkWithRedirect(auth.currentUser, provider);
      return;
    }

    try {
      await linkWithPopup(auth.currentUser, provider);
      return getOrCreateUser();
    } catch (error) {
      console.warn("Popup link failed:", error);

      if (shouldFallbackToRedirect(error)) {
        await linkWithRedirect(auth.currentUser, provider);
        return;
      }

      throw error;
    }
  }

  if (useRedirectDirectly) {
    await signInWithRedirect(auth, provider);
    return;
  }

  try {
    await signInWithPopup(auth, provider);
    return getOrCreateUser();
  } catch (error) {
    console.warn("Popup sign-in failed:", error);

    if (shouldFallbackToRedirect(error)) {
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
  await updateDoc(doc(db, "users", uid), {
    activePlan: null,
    planStartDate: null,
    updatedAt: serverTimestamp(),
  });

  await deleteStudyPlan(uid);
}

export function timestampToDate(value: Timestamp | null) {
  return value ? value.toDate() : null;
}
