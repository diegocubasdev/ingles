import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    VitePWA({
      registerType: "autoUpdate",
      manifestFilename: "manifest.webmanifest",

      includeAssets: ["favicon.svg", "icon-192.png", "icon-512.png"],

      manifest: {
        name: "Intensive English PWA",
        short_name: "English PWA",
        description: "Treino intensivo de ingles com escuta, fala e montagem.",
        theme_color: "#111827",
        background_color: "#f8fafc",
        display: "standalone",
        orientation: "portrait",

        /**
         * Não iniciar direto em /dashboard.
         * No iOS/PWA isso pode carregar a rota protegida antes do Firebase
         * restaurar a sessão.
         */
        start_url: "/",
        scope: "/",

        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },

      workbox: {
        navigateFallback: "/index.html",

        /**
         * Não deixa o Service Worker interceptar as rotas internas
         * do Firebase Auth.
         */
        navigateFallbackDenylist: [/^\/__\/auth\//, /^\/__/],

        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],

        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/__/auth/"),
            handler: "NetworkOnly",
            options: {
              cacheName: "firebase-auth-network-only",
            },
          },
        ],
      },
    }),
  ],
});
