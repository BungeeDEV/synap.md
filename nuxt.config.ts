import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-07-15',

  devtools: {enabled: true},

  modules: ['@nuxt/eslint', 'nuxt-auth-utils', '@pinia/nuxt', '@vite-pwa/nuxt'],

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      // viewport-fit=cover is what makes env(safe-area-inset-*) resolve to
      // non-zero values on notched/home-indicator devices instead of 0.
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
      link: [
        { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' }
      ],
      meta: [
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }
      ]
    }
  },

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: [
        '@codemirror/autocomplete',
        '@codemirror/commands',
        '@codemirror/lang-markdown',
        '@codemirror/language',
        '@codemirror/state',
        '@codemirror/view',
        '@lezer/highlight',
        'lucide-vue-next'
      ]
    },
    build: {
      // The CodeMirror stack (state+view+commands+autocomplete+lang-markdown
      // +lezer-highlight) is its own lazy chunk (index.vue uses
      // <LazyNoteEditor>, not <NoteEditor>) and only loads once a note is
      // actually opened - it just doesn't fit Rollup's generic 500kB default
      // on its own. Raised rather than silenced entirely so a genuinely
      // oversized *eager* chunk would still warn.
      chunkSizeWarningLimit: 600
    }
  },

  // Values below are just build-time fallback defaults - the ones that
  // actually matter at container runtime come from Nitro's automatic
  // NUXT_<KEY> env var mapping (e.g. NUXT_VAULT_PATH), which re-reads
  // process.env on every request/boot. A plain, non-prefixed process.env
  // read here only affects what gets baked into the build, which is wrong
  // for a container built once and run with different env per deployment -
  // see decisions.md.
  runtimeConfig: {
    vaultPath: './.data/vault',
    dataPath: './.data/app.db',
    maxAttachmentSizeMb: '10',
    trashRetentionDays: '30',
    // session.password is injected by nuxt-auth-utils itself, mapped
    // automatically from NUXT_SESSION_PASSWORD
    public: {
      appVersion: pkg.version
    }
  },

  // App-shell-only PWA (Phase 8): precache the built JS/CSS/icons, but never
  // cache /api/* - note data must always come from the network so an offline
  // session can't silently serve stale vault content. See
  // app/plugins/fetch-error-toast.client.ts for the accompanying "offline"
  // user feedback when an /api/* call actually fails.
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'synap.md',
      short_name: 'synap.md',
      description: 'Ein Markdown-Notizen-Editor mit Vault-basierter Dateiverwaltung.',
      theme_color: '#141414',
      background_color: '#141414',
      display: 'standalone',
      start_url: '/',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: {
      navigateFallbackDenylist: [/^\/api\//],
      globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
      runtimeCaching: [
        {
          // Defense in depth alongside navigateFallbackDenylist above - even
          // if something matches the navigate fallback, plain data requests
          // to /api/* must never be served from cache.
          urlPattern: /^\/api\/.*/,
          handler: 'NetworkOnly'
        },
        {
          urlPattern: ({ request }) => ['style', 'script', 'image', 'font'].includes(request.destination),
          handler: 'StaleWhileRevalidate',
          options: { cacheName: 'static-assets' }
        }
      ]
    }
    // devOptions intentionally omitted (defaults to disabled): registering a
    // service worker under `nuxt dev` fights Vite's own module/HMR caching -
    // observed as sporadic wrong-MIME-type failures on dynamically imported
    // chunks after a client-side navigation. Verify installability/offline
    // behavior against a production build instead: `pnpm build && pnpm preview`.
  },

  // Bundles the raw .sql migration files into the Nitro server output so
  // the migration runner can read them via useStorage('assets:migrations')
  // in production too, not just in dev where the source tree is on disk.
  nitro: {
    // dir is relative to nitro's srcDir, which Nuxt already sets to
    // <rootDir>/server - so this is server/database/migrations, not
    // server/server/database/migrations.
    serverAssets: [
      { baseName: 'migrations', dir: './database/migrations' }
    ]
  }
})