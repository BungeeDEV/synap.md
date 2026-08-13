<script setup lang="ts">
import { CircleCheck, CircleX, ChevronDown, ChevronUp, Loader2, RotateCcw, SkipForward, X } from '@lucide/vue'

const { progress, cancelRemaining, closeProgressPanel, toggleProgressCollapsed, retryImportFile } = useVaultImport()

const total = computed(() => progress.value?.files.length ?? 0)
const completedCount = computed(() => progress.value?.files.filter((f) => f.status !== 'pending' && f.status !== 'uploading').length ?? 0)
const progressPercent = computed(() => total.value === 0 ? 0 : Math.round((completedCount.value / total.value) * 100))
const hasPendingRemaining = computed(() => progress.value?.files.some((f) => f.status === 'pending' || f.status === 'uploading') ?? false)

const summaryText = computed(() => {
  if (!progress.value) return ''
  return progress.value.done ? `${completedCount.value} von ${total.value} verarbeitet` : `${completedCount.value} von ${total.value} importiert`
})
</script>

<template>
  <Transition enter-active-class="transition duration-150 ease-out" leave-active-class="transition duration-100 ease-in" enter-from-class="translate-y-2 opacity-0" leave-to-class="translate-y-2 opacity-0">
    <div
      v-if="progress"
      class="fixed inset-x-3 bottom-16 z-40 ml-auto w-full max-w-80 touch-manipulation select-none overflow-hidden rounded-xl border border-border-strong bg-surface-1 shadow-float"
    >
      <div class="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <p class="min-w-0 flex-1 truncate text-sm font-medium text-content-primary">
          {{ summaryText }}
        </p>
        <button
          type="button"
          class="shrink-0 rounded-md p-1 text-content-tertiary transition duration-150 hover:bg-white/[0.04] hover:text-content-secondary"
          :title="progress.collapsed ? 'Liste einblenden' : 'Liste ausblenden'"
          @click="toggleProgressCollapsed"
        >
          <ChevronUp v-if="progress.collapsed" class="h-4 w-4" stroke-width="1.5" />
          <ChevronDown v-else class="h-4 w-4" stroke-width="1.5" />
        </button>
        <button
          type="button"
          class="shrink-0 rounded-md p-1 text-content-tertiary transition duration-150 hover:bg-white/[0.04] hover:text-content-secondary"
          title="Schließen"
          @click="closeProgressPanel"
        >
          <X class="h-4 w-4" stroke-width="1.5" />
        </button>
      </div>

      <div class="h-1 w-full bg-surface-2">
        <div class="h-full bg-accent transition-all duration-200 ease-out" :style="{ width: `${progressPercent}%` }" />
      </div>

      <Transition enter-active-class="grid transition-all duration-150 ease-out" leave-active-class="grid transition-all duration-150 ease-out" enter-from-class="grid-rows-collapsed" enter-to-class="grid-rows-expanded" leave-from-class="grid-rows-expanded" leave-to-class="grid-rows-collapsed">
        <div v-if="!progress.collapsed">
          <div class="overflow-hidden">
            <ul class="max-h-56 space-y-0.5 overflow-y-auto p-1.5">
              <li
                v-for="(file, index) in progress.files"
                :key="file.name + index"
                class="flex items-center gap-2 rounded-md px-2 py-1.5"
              >
                <Loader2 v-if="file.status === 'uploading'" class="h-4 w-4 shrink-0 animate-spin text-accent" stroke-width="1.5" />
                <CircleCheck v-else-if="file.status === 'imported'" class="h-4 w-4 shrink-0 text-success" stroke-width="1.5" />
                <SkipForward v-else-if="file.status === 'skipped' || file.status === 'cancelled'" class="h-4 w-4 shrink-0 text-content-tertiary" stroke-width="1.5" />
                <CircleX v-else-if="file.status === 'error'" class="h-4 w-4 shrink-0 text-danger" stroke-width="1.5" />
                <span v-else class="h-4 w-4 shrink-0 rounded-full border border-border-strong" />

                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm" :class="file.status === 'error' ? 'text-danger' : 'text-content-secondary'">
                    {{ file.name }}
                  </p>
                  <p v-if="file.status === 'error' && file.error" class="truncate text-xs text-danger/80">
                    {{ file.error }}
                  </p>
                </div>

                <button
                  v-if="file.status === 'error'"
                  type="button"
                  class="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-content-secondary transition duration-150 hover:bg-white/[0.04] active:scale-95"
                  title="Erneut versuchen"
                  @click="retryImportFile(index)"
                >
                  <RotateCcw class="h-3.5 w-3.5" stroke-width="1.5" />
                  Erneut
                </button>
              </li>
            </ul>
          </div>
        </div>
      </Transition>

      <div v-if="hasPendingRemaining" class="border-t border-border px-3 py-2">
        <button
          type="button"
          class="text-sm text-content-tertiary transition-colors duration-150 hover:text-content-secondary"
          @click="cancelRemaining"
        >
          Verbleibende abbrechen
        </button>
      </div>
    </div>
  </Transition>
</template>
