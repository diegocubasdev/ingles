const REMINDER_HOURS = [12, 20, 22]
const STORAGE_KEY = 'intensive-english-notifications-enabled'

let scheduledTimeouts: number[] = []

export function getNotificationSettings() {
  return {
    enabled: localStorage.getItem(STORAGE_KEY) === 'true',
    permission: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
    hours: REMINDER_HOURS,
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

export function startNotificationSchedulerIfEnabled() {
  if (localStorage.getItem(STORAGE_KEY) === 'true') {
    scheduleDailyStudyNotifications()
  }
}

function scheduleDailyStudyNotifications() {
  scheduledTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId))
  scheduledTimeouts = REMINDER_HOURS.map((hour) => scheduleNextReminder(hour))
}

function scheduleNextReminder(hour: number) {
  const delay = getDelayUntilHour(hour)

  const timeoutId = window.setTimeout(() => {
    void showStudyNotification(hour)

    if (localStorage.getItem(STORAGE_KEY) === 'true') {
      const nextTimeout = scheduleNextReminder(hour)
      scheduledTimeouts = scheduledTimeouts.filter((currentTimeoutId) => currentTimeoutId !== timeoutId)
      scheduledTimeouts.push(nextTimeout)
    }
  }, delay)

  return timeoutId
}

function getDelayUntilHour(hour: number) {
  const now = new Date()
  const next = new Date(now)
  next.setHours(hour, 0, 0, 0)

  if (next <= now) {
    next.setDate(next.getDate() + 1)
  }

  return next.getTime() - now.getTime()
}

async function showStudyNotification(hour: number) {
  const title = 'Hora do treino de ingles'
  const body = `Seu lembrete das ${String(hour).padStart(2, '0')}:00 chegou. Continue as tarefas do dia.`
  const options: NotificationOptions = {
    body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: `english-study-${hour}`,
    requireInteraction: false,
  }

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready
    await registration.showNotification(title, options)
    return
  }

  new Notification(title, options)
}
