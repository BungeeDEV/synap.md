import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import tailwindcss from '@tailwindcss/vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

// createRequire resolves modules relative to this config file (apps/web/), so
// require.resolve('vue') / require.resolve('pinia') return the actual entry
// files from apps/web/node_modules — the same instances @pinia/nuxt uses.
const require = createRequire(import.meta.url)

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-07-15',

  alias: {
    '@synap/design-tokens': fileURLToPath(new URL('../../packages/design-tokens/src/index.ts', import.meta.url)),
    '@synap/i18n': fileURLToPath(new URL('../../packages/i18n/src/index.ts', import.meta.url)),
  },

  devtools: {enabled: true},

  modules: ['@nuxt/eslint', 'nuxt-auth-utils', '@pinia/nuxt', '@vite-pwa/nuxt'],

  css: ['~/assets/css/main.css', 'katex/dist/katex.min.css'],

  // The Pinia stores used to live under app/stores/, where @pinia/nuxt
  // auto-imports by directory convention. They moved into the @synap/store
  // package, so that convention no longer applies - this preset restores
  // auto-import for the 5 store hooks so the ~23 call sites don't each need
  // an explicit import.
  imports: {
    presets: [
      {
        from: '@synap/store',
        imports: [
          'usePreferencesStore',
          'useTabsStore',
          'useVaultTreeStore',
          'useMobileNavStore',
          'useSidebarPanelStore'
        ]
      }
    ]
  },

  app: {
    head: {
      // viewport-fit=cover is what makes env(safe-area-inset-*) resolve to
      // non-zero values on notched/home-indicator devices instead of 0.
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
      link: [
        { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' }
      ],
      meta: [
        // apple-mobile-web-app-capable is iOS-Safari-specific and still the
        // only one it honors, but Chromium now warns it's deprecated in
        // favor of the standard mobile-web-app-capable - kept both rather
        // than dropping the Apple one and breaking "Add to Home Screen" on
        // iOS.
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }
      ]
    }
  },

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      // @synap/store is `dependenciesMeta.injected` (apps/web/package.json),
      // so pnpm creates a physical copy in node_modules rather than a symlink.
      // In Docker the installer stage runs `pnpm install` before the package
      // source files exist (turbo prune only copies package.json files first),
      // leaving the injected copy empty — Rolldown then fails to resolve
      // `@synap/store` during the client build.  Aliasing directly to the
      // source entry bypasses the node_modules copy entirely.
      //
      // Side-effect: Vite resolves imports *within* packages/store/src/*.ts
      // via Node.js resolution starting at packages/store/, so 'pinia' and
      // 'vue' resolve to packages/store/node_modules/ (typescript@7.x peers)
      // instead of apps/web/node_modules/ (typescript@5.9.x peers used by
      // @pinia/nuxt).  Two distinct module objects → two activePinia singletons
      // → "undefined is not an object (evaluating 'n._s')" 500 error.
      // Explicit pinia/vue aliases below collapse both back to the single
      // apps/web instance that @pinia/nuxt already uses.
      // require.resolve() uses CJS resolution from apps/web/, reliably
      // returning the apps/web entry for pinia.  vue.esm-bundler.js is the
      // standard Vite/bundler entry (runtime + compiler stub, tree-shaken to
      // runtime-only in production).
      alias: [
        {
          find: '@synap/store',
          replacement: fileURLToPath(new URL('../../packages/store/src/index.ts', import.meta.url))
        },
        {
          find: '@synap/design-tokens',
          replacement: fileURLToPath(new URL('../../packages/design-tokens/src/index.ts', import.meta.url))
        },
        {
          find: '@synap/i18n',
          replacement: fileURLToPath(new URL('../../packages/i18n/src/index.ts', import.meta.url))
        },
        // pinia and vue each end up with two separate physical instances in
        // node_modules because apps/web pins typescript@5.9.x while
        // packages/store picks up typescript@7.x for its peers. The vite
        // alias above redirects @synap/store source files to packages/store/,
        // so their `import … from 'pinia'` / `import … from 'vue'` resolve
        // from packages/store/node_modules/ (the @7 instance), while
        // @pinia/nuxt uses apps/web/node_modules/ (the @5.9 instance).
        // Two distinct module objects → two activePinia singletons →
        // runtime 500 "undefined is not an object (evaluating 'n._s')".
        //
        // require.resolve() follows CJS resolution from apps/web/, returning
        // the correct instance entries. The /^pinia$/ and /^vue$/ regexes
        // match only the bare specifiers, leaving sub-path imports like
        // vue/server-renderer unaffected.
        {
          find: /^pinia$/,
          replacement: require.resolve('pinia')
        },
        {
          find: /^vue$/,
          replacement: fileURLToPath(new URL('./node_modules/vue/dist/vue.esm-bundler.js', import.meta.url))
        }
      ]
    },
    optimizeDeps: {
      include: [
        '@tiptap/core',
        '@tiptap/vue-3',
        '@tiptap/vue-3/menus',
        '@tiptap/starter-kit',
        '@tiptap/extension-image',
        '@tiptap/extension-task-list',
        '@tiptap/extension-task-item',
        '@tiptap/extension-placeholder',
        '@tiptap/suggestion',
        '@tiptap/pm/state',
        '@tiptap/pm/model',
        '@tiptap/pm/view',
        '@tiptap/pm/tables',
        '@floating-ui/dom',
        'tiptap-markdown',
        '@lucide/vue'
      ]
    },
    build: {
      // The Tiptap/ProseMirror stack (core+vue-3+starter-kit+the extensions
      // above+tiptap-markdown) is its own lazy chunk (index.vue uses
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
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
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
  //
  // @synap/store is `dependenciesMeta.injected` (apps/web/package.json) so
  // it gets its own physical copy built against apps/web's own pinia/vue
  // instance instead of a plain symlink - see decisions.md ("Pinia
  // singleton across the store/pinia peer-context split") for why that's
  // necessary. The tradeoff: an injected package is a real copy physically
  // inside node_modules, which Nitro's rollup pipeline treats as a
  // pre-built external and won't run through its TS transform (it works
  // for a plain symlinked workspace package only because that resolves
  // outside node_modules via realpath). server/utils/preferences.ts only
  // needs the small, pinia/vue-free preferences_types.ts (not the Pinia
  // store definitions), so this alias repoints that one subpath straight at
  // the real source tree instead of the injected node_modules copy -
  // avoids the parse failure without needing Nitro to transpile node_modules
  // at all.
  nitro: {
    // dir is relative to nitro's srcDir, which Nuxt already sets to
    // <rootDir>/server - so this is server/database/migrations, not
    // server/server/database/migrations.
    serverAssets: [
      { baseName: 'migrations', dir: './database/migrations' }
    ],
    alias: {
      '@synap/store/preferences_types': fileURLToPath(new URL('../../packages/store/src/preferences_types.ts', import.meta.url))
    }
  }
})