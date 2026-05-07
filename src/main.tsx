import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import { router } from './router'
import { startNotificationSchedulerIfEnabled } from './services/notificationService'
import { initializeTheme } from './services/themeService'

registerSW({ immediate: true })
initializeTheme()
startNotificationSchedulerIfEnabled()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
