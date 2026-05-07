import {
  GoogleAuthProvider,
  browserLocalPersistence,
  linkWithPopup,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
  signInWithPopup,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import type { User } from '../types'

const defaultUser = (uid: string): User => ({
  uid,
  name: 'Student',
  currentLevel: 'A1',
  xp: 0,
  streakDays: 0,
  lastActiveDate: null,
  activePlan: null,
  planStartDate: null,
})

export function waitForAuthUser() {
  return new Promise<NonNullable<typeof auth.currentUser>>((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        unsubscribe()
        if (firebaseUser) {
          resolve(firebaseUser)
          return
        }

        try {
          await setPersistence(auth, browserLocalPersistence)
          const credential = await signInAnonymously(auth)
          resolve(credential.user)
        } catch (error) {
          reject(error)
        }
      },
      reject,
    )
  })
}

export async function getOrCreateUser(): Promise<User> {
  const firebaseUser = await waitForAuthUser()
  const displayName = firebaseUser.displayName ?? undefined
  const ref = doc(db, 'users', firebaseUser.uid)
  const snapshot = await getDoc(ref)

  if (snapshot.exists()) {
    const user = snapshot.data() as User
    if (displayName && user.name !== displayName) {
      await setDoc(ref, { name: displayName, updatedAt: serverTimestamp() }, { merge: true })
      return { ...user, name: displayName }
    }

    return user
  }

  const user = { ...defaultUser(firebaseUser.uid), name: displayName ?? 'Student' }
  await setDoc(ref, {
    ...user,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return user
}

export async function signInWithGoogle(): Promise<User> {
  await setPersistence(auth, browserLocalPersistence)

  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })

  try {
    if (auth.currentUser?.isAnonymous) {
      await linkWithPopup(auth.currentUser, provider)
    } else {
      await signInWithPopup(auth, provider)
    }
  } catch {
    await signInWithPopup(auth, provider)
  }

  return getOrCreateUser()
}

export function getAuthUser() {
  return auth.currentUser
}

export async function getUser(uid: string): Promise<User | null> {
  const snapshot = await getDoc(doc(db, 'users', uid))
  return snapshot.exists() ? (snapshot.data() as User) : null
}

export function timestampToDate(value: Timestamp | null) {
  return value ? value.toDate() : null
}
