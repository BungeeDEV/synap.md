<script setup lang="ts">
import { LogOut, Menu, Search } from '@lucide/vue'
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{ logout: [], openCommandPalette: [] }>()

const mobileNav = useMobileNavStore()
const tabs = useTabsStore()
const { t } = useI18n()
</script>

<template>
  <header class="flex h-12 shrink-0 touch-manipulation select-none items-center justify-between gap-1 border-b border-border bg-surface-1 px-1 pt-safe-t md:hidden">
    <button
      type="button"
      class="shrink-0 rounded-md p-3 text-content-secondary transition-colors duration-150 hover:bg-white/[0.04]"
      :title="t('common.menu')"
      @click="mobileNav.toggle()"
    >
      <Menu class="h-5 w-5" stroke-width="1.5" />
    </button>

    <span class="min-w-0 flex-1 truncate text-center text-sm text-content-tertiary">
      {{ tabs.activeTab?.title ?? 'synap.md' }}
    </span>

    <div class="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        class="rounded-md p-3 text-content-secondary transition-colors duration-150 hover:bg-white/[0.04]"
        :title="t('common.search')"
        @click="emit('openCommandPalette')"
      >
        <Search class="h-5 w-5" stroke-width="1.5" />
      </button>
      <button
        type="button"
        class="rounded-md p-3 text-content-secondary transition-colors duration-150 hover:bg-white/[0.04]"
        :title="t('auth.logout')"
        @click="emit('logout')"
      >
        <LogOut class="h-5 w-5" stroke-width="1.5" />
      </button>
    </div>
  </header>
</template>
