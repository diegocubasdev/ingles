import {
  GoogleAuthProvider,
  browserLocalPersistence,
  linkWithRedirect,
  onAuthStateChanged,
  setPersistence,
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

function createGoogleProvider() {
  const provider = new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: "select_account",
  });

  return provider;
}

export function waitForAuthUser() {
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

export async function signInWithGoogle(): Promise<void> {
  await setPersistence(auth, browserLocalPersistence);

  const provider = createGoogleProvider();

  if (auth.currentUser?.isAnonymous) {
    await linkWithRedirect(auth.currentUser, provider);
    return;
  }

  await signInWithRedirect(auth, provider);
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
