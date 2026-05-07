const DEFAULT_REMINDER_TIMES = ['12:00', '20:00', '22:00']
const STORAGE_KEY = 'intensive-english-notifications-enabled'
const TIMES_STORAGE_KEY = 'intensive-english-notification-times'

let scheduledTimeouts: number[] = []

export function getNotificationSettings() {
  return {
    enabled: localStorage.getItem(STORAGE_KEY) === 'true',
    permission: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
    times: getReminderTimes(),
  }
}

export async function enableDailyStudyNotifications() {
  if (typeof Notification === 'undefined') {
    throw new Error('Este navegador nao suporta notificacoes.')
  }

  const permission =
    Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission

  if (permission !== 'granted') {
    throw new Error('Permissao de notificacao nao concedida.')
  }

  localStorage.setItem(STORAGE_KEY, 'true')
  scheduleDailyStudyNotifications()
}

export function disableDailyStudyNotifications() {
  localStorage.removeItem(STORAGE_KEY)
  scheduledTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId))
  scheduledTimeouts = []
}

export function updateDailyStudyNotificationTimes(times: string[]) {
  const normalizedTimes = normalizeTimes(times)
  localStorage.setItem(TIMES_STORAGE_KEY, JSON.stringify(normalizedTimes))

  if (localStorage.getItem(STORAGE_KEY) === 'true') {
    scheduleDailyStudyNotifications()
  }

  return normalizedTimes
}

export function startNotificationSchedulerIfEnabled() {
  if (localStorage.getItem(STORAGE_KEY) === 'true') {
    scheduleDailyStudyNotifications()
  }
}

function scheduleDailyStudyNotifications() {
  scheduledTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId))
  scheduledTimeouts = getReminderTimes().map((time) => scheduleNextReminder(time))
}

function scheduleNextReminder(time: string) {
  const delay = getDelayUntilTime(time)

  const timeoutId = window.setTimeout(() => {
    void showStudyNotification(time)

    if (localStorage.getItem(STORAGE_KEY) === 'true') {
      const nextTimeout = scheduleNextReminder(time)
      scheduledTimeouts = scheduledTimeouts.filter((currentTimeoutId) => currentTimeoutId !== timeoutId)
      scheduledTimeouts.push(nextTimeout)
    }
  }, delay)

  return timeoutId
}

function getDelayUntilTime(time: string) {
  const now = new Date()
  const next = new Date(now)
  const [hours, minutes] = time.split(':').map(Number)
  next.setHours(hours, minutes, 0, 0)

  if (next <= now) {
    next.setDate(next.getDate() + 1)
  }

  return next.getTime() - now.getTime()
}

async function showStudyNotification(time: string) {
  const title = 'Hora do treino de ingles'
  const body = `Seu lembrete das ${time} chegou. Continue as tarefas do dia.`
  const options: NotificationOptions = {
    body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: `english-study-${time}`,
    requireInteraction: false,
  }

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready
    await registration.showNotification(title, options)
    return
  }

  new Notification(title, options)
}

function getReminderTimes() {
  const rawTimes = localStorage.getItem(TIMES_STORAGE_KEY)
  if (!rawTimes) return DEFAULT_REMINDER_TIMES

  try {
    const parsedTimes = JSON.parse(rawTimes) as unknown
    return Array.isArray(parsedTimes) ? normalizeTimes(parsedTimes.filter((time) => typeof time === 'string')) : DEFAULT_REMINDER_TIMES
  } catch {
    return DEFAULT_REMINDER_TIMES
  }
}

function normalizeTimes(times: string[]) {
  const validTimes = times
    .filter((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    .sort((a, b) => a.localeCompare(b))

  return Array.from(new Set(validTimes.length > 0 ? validTimes : DEFAULT_REMINDER_TIMES))
}
