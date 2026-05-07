import confetti from 'canvas-confetti'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { useCallback } from 'react'
import { db } from '../services/firebase'
import type { User } from '../types'

export function useGamification(uid?: string) {
  const checkAndUpdateStreak = useCallback(async () => {
    if (!uid) return 0

    const userRef = doc(db, 'users', uid)
    const snapshot = await getDoc(userRef)
    if (!snapshot.exists()) return 0

    const user = snapshot.data() as User
    const today = toDateKey(new Date())
    const yesterday = toDateKey(addDays(new Date(), -1))
    const lastActiveDate = user.lastActiveDate

    let nextStreak = user.streakDays ?? 0
    if (lastActiveDate === today) {
      return nextStreak
    }

    if (lastActiveDate === yesterday) {
      nextStreak += 1
    } else {
      nextStreak = 1
    }

    await updateDoc(userRef, {
      streakDays: nextStreak,
      lastActiveDate: today,
    })

    return nextStreak
  }, [uid])

  const triggerSuccessConfetti = useCallback(() => {
    const duration = 1800
    const animationEnd = Date.now() + duration
    const defaults = {
      startVelocity: 34,
      spread: 80,
      ticks: 80,
      zIndex: 1000,
    }

    const interval = window.setInterval(() => {
      const timeLeft = animationEnd - Date.now()

      if (timeLeft <= 0) {
        window.clearInterval(interval)
        return
      }

      const particleCount = Math.round(45 * (timeLeft / duration))
      void confetti({
        ...defaults,
        particleCount,
        origin: { x: 0.5, y: 0.25 },
        colors: ['#22c55e', '#f59e0b', '#38bdf8', '#f43f5e', '#a855f7'],
      })
    }, 220)
  }, [])

  return { checkAndUpdateStreak, triggerSuccessConfetti }
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}
