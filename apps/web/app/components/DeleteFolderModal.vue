<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Folder, ShieldAlert } from '@lucide/vue'
import type { VaultTreeNode } from '@synap/store'

const props = defineProps<{
  node: VaultTreeNode
}>()

const emit = defineEmits<{
  confirm: [],
  cancel: []
}>()

const isRecursiveChecked = ref(false)

const itemCount = computed(() => props.node.children?.length ?? 0)
const containsFiles = computed(() => itemCount.value > 0)

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('cancel')
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))

function onConfirm() {
  if (containsFiles.value && !isRecursiveChecked.value) return
  emit('confirm')
}
</script>

<template>
  <Teleport to="body">
  <Transition appear enter-active-class="transition duration-150 ease-out" leave-active-class="transition duration-100 ease-in" enter-from-class="opacity-0" leave-to-class="opacity-0">
    <div class="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/40" @click="emit('cancel')">
      <Transition appear enter-active-class="transition duration-150 ease-out" leave-active-class="transition duration-100 ease-in" enter-from-class="scale-95 opacity-0" leave-to-class="scale-95 opacity-0">
        <div class="w-full max-w-md rounded-xl border border-border-strong bg-surface-1 p-0 text-base text-content-primary shadow-float overflow-hidden flex flex-col" @click.stop>
          
          <div class="p-6 pb-4">
            <h2 class="mb-4 font-semibold text-content-primary">
              Ordner löschen
            </h2>
            
            <div class="flex items-start gap-3 mb-4">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2">
                <Folder class="h-5 w-5 text-content-secondary" stroke-width="1.5" />
              </div>
              <div>
                <p class="text-sm text-content-primary mb-1">
                  Möchtest du den Ordner <span class="font-semibold break-all">'{{ node.name }}'</span> wirklich löschen?
                </p>
                <p class="text-[13px] text-content-tertiary">
                  Diese Aktion kann nicht rückgängig gemacht werden.
                </p>
              </div>
            </div>

            <template v-if="containsFiles">
              <div class="mb-4 rounded-lg bg-danger/10 border border-danger/20 p-3 flex gap-3">
                <ShieldAlert class="h-5 w-5 shrink-0 text-danger mt-0.5" stroke-width="1.5" />
                <div class="flex flex-col gap-1.5">
                  <p class="text-[13px] font-medium text-danger">Achtung: Der Ordner ist nicht leer!</p>
                  <p class="text-[13px] text-danger/80">
                    Dieser Ordner enthält Elemente. Wenn du ihn löschst, gehen alle darin enthaltenen Unterordner und Notizen dauerhaft verloren.
                  </p>
                </div>
              </div>

              <label class="flex items-center gap-3 cursor-pointer p-3 rounded-md border border-danger/30 bg-danger/5 hover:bg-danger/10 transition-colors">
                <div class="relative flex h-4 w-4 shrink-0 items-center justify-center">
                  <input 
                    type="checkbox" 
                    v-model="isRecursiveChecked" 
                    class="peer appearance-none h-4 w-4 rounded border border-danger/40 bg-surface-2 cursor-pointer transition-colors checked:bg-danger checked:border-danger hover:border-danger focus:outline-none focus:ring-2 focus:ring-danger/50 focus:ring-offset-2 focus:ring-offset-surface-1" 
                  />
                  <svg 
                    class="absolute pointer-events-none opacity-0 peer-checked:opacity-100 h-3 w-3 text-white transition-opacity duration-150" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor" 
                    stroke-width="3"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span class="text-[13px] font-medium text-danger">Ordner rekursiv löschen (inklusive aller Inhalte)</span>
              </label>
            </template>
            <template v-else>
              <div class="rounded-md border border-border bg-surface-2 p-3">
                <p class="flex items-center gap-2 text-[13px] text-content-secondary">
                  <Folder class="h-4 w-4" stroke-width="1.5" /> Der Ordner ist leer und kann sicher gelöscht werden.
                </p>
              </div>
            </template>
          </div>

          <div class="flex justify-end gap-2 border-t border-border bg-surface-2 px-6 py-4">
            <button
              type="button"
              class="rounded-md border border-border-strong px-4 py-2 text-sm text-content-primary transition-colors duration-150 hover:bg-white/[0.04] focus:outline-none focus:ring-1 focus:ring-accent/50"
              @click="emit('cancel')"
            >
              Abbrechen
            </button>
            <button
              type="button"
              class="rounded-md px-4 py-2 text-sm text-white transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-accent/50"
              :class="containsFiles && !isRecursiveChecked ? 'bg-danger/50 cursor-not-allowed' : 'bg-danger hover:bg-danger/90'"
              :disabled="containsFiles && !isRecursiveChecked"
              @click="onConfirm"
            >
              Ordner löschen
            </button>
          </div>
          
        </div>
      </Transition>
    </div>
  </Transition>
  </Teleport>
</template>
