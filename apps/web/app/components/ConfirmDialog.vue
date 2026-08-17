<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Props {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

withDefaults(defineProps<Props>(), {
  destructive: false
})

const emit = defineEmits<{ confirm: [], cancel: [] }>()

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('cancel')
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <!-- Teleported to <body>: this is opened from VaultTree.vue, mounted inside
       VaultSidebar's transformed <aside> - see ContextMenu.vue's Teleport
       comment for why `fixed inset-0` would otherwise only cover the 320px
       sidebar column instead of the real viewport. -->
  <Teleport to="body">
  <Transition appear enter-active-class="transition duration-150 ease-out" leave-active-class="transition duration-100 ease-in" enter-from-class="opacity-0" leave-to-class="opacity-0">
    <div class="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/40" @click="emit('cancel')">
      <Transition appear enter-active-class="transition duration-150 ease-out" leave-active-class="transition duration-100 ease-in" enter-from-class="scale-95 opacity-0" leave-to-class="scale-95 opacity-0">
        <div class="w-full max-w-md rounded-xl border border-border-strong bg-surface-1 p-6 text-base text-content-primary shadow-float" @click.stop>
          <h2 class="mb-2 font-semibold text-content-primary">
            {{ title }}
          </h2>
          <p class="mb-4 text-content-secondary">
            {{ message }}
          </p>
          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="rounded-md border border-border bg-surface-1 px-4 py-2 text-sm font-medium text-content-primary hover:bg-surface-2 focus:ring-2 focus:ring-accent-soft focus:outline-none"
              @click="emit('cancel')"
            >
              {{ cancelLabel || t('dialogs.cancel') }}
            </button>
            <button
              type="button"
              class="rounded-md px-4 py-2 text-sm font-medium text-white focus:ring-2 focus:outline-none"
              :class="destructive ? 'bg-danger hover:bg-danger/90 focus:ring-danger/20' : 'bg-accent hover:bg-accent/90 focus:ring-accent-soft'"
              @click="emit('confirm')"
            >
              {{ confirmLabel || t('dialogs.deleteFolder') }}
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
  </Teleport>
</template>
