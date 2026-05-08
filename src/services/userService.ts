import {
  GoogleAuthProvider,
  browserLocalPersistence,
  linkWithPopup,
  onAuthStateChanged,
  setPersistence,
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
import { auth, db } from "./firebase";
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

export function waitForAuthUser() {
  return new Promise<NonNullable<typeof auth.currentUser> | null>(
    (resolve, reject) => {
      const unsubscribe = onAuthStateChanged(
        auth,
        async (firebaseUser) => {
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
        { name: displayName, updatedAt: serverTimestamp() },
        { merge: true },
      );
      return { ...user, name: displayName };
    }

    return user;
  }

  const user = {
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

export async function signInWithGoogle(): Promise<User> {
  await setPersistence(auth, browserLocalPersistence);

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    // Try popup first
    if (auth.currentUser?.isAnonymous) {
      await linkWithPopup(auth.currentUser, provider);
    } else {
      await signInWithPopup(auth, provider);
    }
  } catch (popupError) {
    console.warn("Popup failed, trying redirect:", popupError);
    try {
      // Fallback to redirect for PWA/mobile
      await signInWithRedirect(auth, provider);
      // For redirect, we need to handle the result separately
      // But since this function returns immediately, we'll handle it in the component
      throw new Error(
        "Redirect initiated - please wait for redirect completion",
      );
    } catch (redirectError) {
      console.error("Both popup and redirect failed:", redirectError);
      throw redirectError;
    }
  }

  return getOrCreateUser();
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
