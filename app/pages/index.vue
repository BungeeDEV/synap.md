<script setup lang="ts">
const { user, fetch: refreshSession } = useUserSession()
const tabs = useTabsStore()
// Destructured to a top-level binding rather than kept as `commandPalette.isOpen` -
// Vue only auto-unwraps refs in templates when they're direct top-level
// <script setup> bindings; a ref nested inside a plain returned object (like
// `commandPalette.isOpen`) is NOT unwrapped by `v-if`, since it only ever
// reads the Ref instance itself (always truthy) rather than tracking `.value`.
const { isOpen: isCommandPaletteOpen, toggle: toggleCommandPalette } = useCommandPalette()

async function handleLogout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await refreshSession()
  await navigateTo('/login')
}

function handleGlobalKeydown(event: KeyboardEvent): void {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    toggleCommandPalette()
  }
}

onMounted(() => window.addEventListener('keydown', handleGlobalKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleGlobalKeydown))
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden bg-base text-content-primary">
    <VaultSidebar />

    <main class="flex min-w-0 flex-1 flex-col">
      <MobileTopBar @logout="handleLogout" @open-command-palette="toggleCommandPalette" />

      <header class="hidden h-9 shrink-0 items-center justify-between border-b border-border px-3 text-xs text-content-tertiary md:flex">
        <span>synap.md<template v-if="user"> — {{ user.username }}</template></span>
        <button type="button" class="transition-colors duration-150 hover:text-content-primary" @click="handleLogout">
          Log out
        </button>
      </header>

      <TabBar v-if="tabs.tabs.length" />

      <div class="min-h-0 flex-1">
        <NoteEditor v-if="tabs.activeTab" :key="tabs.activeTab.path" :path="tabs.activeTab.path" />
        <div v-else class="flex h-full items-center justify-center text-content-tertiary">
          Keine Note geöffnet
        </div>
      </div>
    </main>

    <CommandPalette v-if="isCommandPaletteOpen" />
  </div>
</template>
