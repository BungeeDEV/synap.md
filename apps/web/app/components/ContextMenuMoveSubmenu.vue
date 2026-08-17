<script setup lang="ts">
import { Folder } from '@lucide/vue'
import type { VaultTreeNode } from '@synap/store'
import { folderIndentClass, folderOptionsOf } from '~/utils/vaultFolders'
import { isValidMoveTarget } from '~/utils/vaultMove'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps<{ node: VaultTreeNode }>()
const emit = defineEmits<{ select: [targetFolderPath: string] }>()

const vaultTree = useVaultTreeStore()
const query = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const filteredOptions = computed(() => {
  const options = folderOptionsOf(vaultTree.tree).filter((option) => isValidMoveTarget(props.node, option.path))
  const trimmed = query.value.trim().toLowerCase()
  if (!trimmed) return options
  return options.filter((option) => option.name.toLowerCase().includes(trimmed))
})

onMounted(() => { void nextTick(() => inputRef.value?.focus()) })
</script>

<template>
  <div class="w-56 p-1" @keydown.stop @click.stop>
    <input
      ref="inputRef"
      v-model="query"
      type="text"
      :placeholder="t('palette.searchFolders')"
      class="mb-1 w-full rounded-md border border-border-strong bg-surface-2 px-2.5 py-1.5 text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-1 focus:ring-accent/50"
    >
    <ul class="max-h-60 space-y-0.5 overflow-y-auto">
      <li v-for="option in filteredOptions" :key="option.path || '__root__'">
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-md py-2 pr-2 text-left text-sm text-content-secondary transition-colors duration-150 hover:bg-white/[0.04] hover:text-content-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
          :class="folderIndentClass(option.depth)"
          @click="emit('select', option.path)"
        >
          <Folder class="h-4 w-4 shrink-0 text-content-tertiary" stroke-width="1.5" />
          <span class="truncate">{{ option.name }}</span>
        </button>
      </li>
      <li v-if="filteredOptions.length === 0" class="px-2.5 py-2 text-sm text-content-tertiary">
        Keine Treffer
      </li>
    </ul>
  </div>
</template>
