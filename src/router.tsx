import { createRoute, createRouter, redirect } from "@tanstack/react-router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./services/firebase";
import { DashboardPage } from "./routes/dashboard";
import { IndexPage } from "./routes";
import { Login } from "./routes/login";
import { PracticePage } from "./routes/practice";
import { rootRoute } from "./routes/__root";

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: IndexPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: Login,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  beforeLoad: async (): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        if (
          !user ||
          !user.providerData.some((p) => p.providerId === "google.com")
        ) {
          reject(redirect({ to: "/login" }));
        } else {
          resolve();
        }
      });
    });
  },
  component: DashboardPage,
});

const practiceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/practice",
  beforeLoad: async (): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        if (
          !user ||
          !user.providerData.some((p) => p.providerId === "google.com")
        ) {
          reject(redirect({ to: "/login" }));
        } else {
          resolve();
        }
      });
    });
  },
  component: PracticePage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  dashboardRoute,
  practiceRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
