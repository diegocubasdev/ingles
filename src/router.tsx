import { createRoute, createRouter, redirect } from "@tanstack/react-router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./services/firebase";
import { DashboardPage } from "./routes/dashboard";
import { IndexPage } from "./routes";
import { Login } from "./routes/login";
import { PracticePage } from "./routes/practice";
import { rootRoute } from "./routes/__root";

function waitForFirebaseAuth() {
  return new Promise<typeof auth.currentUser>((resolve, reject) => {
    let unsubscribe: (() => void) | undefined;

    const timeoutId = setTimeout(() => {
      unsubscribe?.();
      reject(new Error("Auth check timeout"));
    }, 15000);

    unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        clearTimeout(timeoutId);
        unsubscribe?.();
        resolve(user);
      },
      (error) => {
        clearTimeout(timeoutId);
        unsubscribe?.();
        reject(error);
      },
    );
  });
}

async function requireAuth() {
  try {
    const user = await waitForFirebaseAuth();

    if (!user) {
      throw redirect({
        to: "/login",
        replace: true,
      });
    }

    return user;
  } catch (error) {
    if (error instanceof Error) {
      console.error("Auth check error:", error.message);
    }

    throw redirect({
      to: "/login",
      replace: true,
    });
  }
}

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
  beforeLoad: async () => {
    await requireAuth();
  },
  component: DashboardPage,
});

const practiceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/practice",
  beforeLoad: async () => {
    await requireAuth();
  },
  component: PracticePage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  dashboardRoute,
  practiceRoute,
]);

export const router = createRouter({
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
