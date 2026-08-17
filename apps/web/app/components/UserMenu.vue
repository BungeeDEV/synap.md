<script setup lang="ts">
import { LogOut, Settings } from '@lucide/vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps<{ username?: string }>()
const emit = defineEmits<{ logout: [] }>()

const isOpen = ref(false)

const initials = computed(() => (props.username ?? '?').slice(0, 2).toUpperCase())

function toggle(): void {
  isOpen.value = !isOpen.value
}

function close(): void {
  isOpen.value = false
}

function onSettings(): void {
  close()
  navigateTo('/settings')
}

function onLogout(): void {
  close()
  emit('logout')
}
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-medium text-accent transition duration-150 hover:bg-accent/30 active:scale-95"
      :title="t('common.userMenu')"
      @click="toggle"
    >
      {{ initials }}
    </button>

    <div v-if="isOpen" class="fixed inset-0 z-40" @click="close" />
    <Transition
      enter-active-class="transition duration-150 ease-out"
      leave-active-class="transition duration-100 ease-in"
      enter-from-class="scale-95 opacity-0"
      leave-to-class="scale-95 opacity-0"
    >
      <div
        v-if="isOpen"
        class="absolute right-0 top-full z-50 mt-1 min-w-40 origin-top-right rounded-lg border border-border-strong bg-surface-1 py-1 text-content-primary shadow-float"
      >
        <p v-if="username" class="truncate px-3.5 py-1.5 text-sm text-content-tertiary">
          {{ username }}
        </p>
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3.5 py-2 text-left transition-colors duration-150 hover:bg-surface-2"
          @click="onSettings"
        >
          <Settings class="h-4 w-4 text-content-tertiary" stroke-width="1.5" />
          {{ t('sidebar.settings') }}
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3.5 py-2 text-left text-danger transition-colors duration-150 hover:bg-surface-2"
          @click="onLogout"
        >
          <LogOut class="h-4 w-4" stroke-width="1.5" />
          {{ t('auth.logout') }}
        </button>
      </div>
    </Transition>
  </div>
</template>
