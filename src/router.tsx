import { createRoute, createRouter } from '@tanstack/react-router'
import { DashboardPage } from './routes/dashboard'
import { IndexPage } from './routes'
import { PracticePage } from './routes/practice'
import { rootRoute } from './routes/__root'

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexPage,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: DashboardPage,
})

const practiceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/practice',
  component: PracticePage,
})

const routeTree = rootRoute.addChildren([indexRoute, dashboardRoute, practiceRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
