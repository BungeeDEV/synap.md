<script setup lang="ts">
import { Folder } from 'lucide-vue-next'
import type { VaultTreeNode } from '~/stores/vaultTree'
import { folderIndentClass, folderOptionsOf } from '~/utils/vaultFolders'
import { isValidMoveTarget } from '~/utils/vaultMove'

const props = defineProps<{ node: VaultTreeNode }>()
const emit = defineEmits<{ confirm: [targetFolderPath: string], cancel: [] }>()

const vaultTree = useVaultTreeStore()

const folderOptions = computed(() => folderOptionsOf(vaultTree.tree))

const selectedFolder = ref('')

function isDisabled(targetFolderPath: string): boolean {
  return !isValidMoveTarget(props.node, targetFolderPath)
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('cancel')
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <Transition appear enter-active-class="transition duration-150 ease-out" leave-active-class="transition duration-100 ease-in" enter-from-class="opacity-0" leave-to-class="opacity-0">
    <div class="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/40" @click="emit('cancel')">
      <Transition appear enter-active-class="transition duration-150 ease-out" leave-active-class="transition duration-100 ease-in" enter-from-class="scale-95 opacity-0" leave-to-class="scale-95 opacity-0">
        <div class="mx-4 flex max-h-dialog w-full max-w-sm flex-col rounded-xl border border-border-strong bg-surface-1 shadow-float" @click.stop>
          <div class="shrink-0 border-b border-border px-4 py-3">
            <h2 class="font-semibold text-content-primary">
              Verschieben nach…
            </h2>
            <p class="mt-0.5 truncate text-sm text-content-tertiary">
              {{ node.name }}
            </p>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto p-2">
            <ul class="space-y-0.5">
              <li v-for="option in folderOptions" :key="option.path || '__root__'">
                <button
                  type="button"
                  :disabled="isDisabled(option.path)"
                  class="flex w-full items-center gap-2 rounded-md py-2.5 pr-2 text-left text-base transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40"
                  :class="[folderIndentClass(option.depth), selectedFolder === option.path ? 'bg-surface-2 text-content-primary' : 'text-content-secondary hover:bg-white/[0.04]']"
                  @click="selectedFolder = option.path"
                >
                  <Folder class="h-5 w-5 shrink-0 text-content-tertiary" stroke-width="1.5" />
                  <span class="truncate">{{ option.name }}</span>
                </button>
              </li>
            </ul>
          </div>

          <div class="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
            <button
              type="button"
              class="rounded-md border border-border-strong px-4 py-2 text-content-primary transition-colors duration-150 hover:bg-white/[0.04] focus:outline-none focus:ring-1 focus:ring-accent/50"
              @click="emit('cancel')"
            >
              Abbrechen
            </button>
            <button
              type="button"
              :disabled="isDisabled(selectedFolder)"
              class="rounded-md bg-accent px-4 py-2 text-white transition-colors duration-150 hover:bg-accent/90 focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
              @click="emit('confirm', selectedFolder)"
            >
              Verschieben
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>
