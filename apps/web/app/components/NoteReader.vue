<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const props = defineProps<{ path: string }>()

const tabs = useTabsStore()
const html = ref('')
const loading = ref(false)
const container = ref<HTMLDivElement | null>(null)
const scrollContainer = ref<HTMLDivElement | null>(null)
const tocVisible = ref(true)

const activeTab = computed(() => tabs.tabs.find((t) => t.path === props.path))
const title = computed(() => activeTab.value?.title ?? '')
const mode = computed(() => activeTab.value?.viewMode ?? 'editor')
// Re-render whenever the on-disk content we know about changes (a save
// completing, or "externe Version laden" during a conflict) - both update
// lastKnownMtime, which render.get.ts's source (the file on disk) tracks.
const mtime = computed(() => activeTab.value?.lastKnownMtime ?? null)

async function load(): Promise<void> {
  loading.value = true
  try {
    const response = await $fetch<{ html: string }>('/api/vault/render', { query: { path: props.path } })
    html.value = response.html
  } finally {
    loading.value = false
  }
}

watch([() => props.path, mtime], () => { void load() }, { immediate: true })

// rehype-sanitize strips <style> and inline style="" for us server-side, but
// there's no Tailwind-class equivalent of an attribute selector for content
// injected via v-html - so broken wikilinks get their text-danger class
// added here in JS instead, once the DOM has actually updated.
watch(html, async () => {
  await nextTick()
  container.value?.querySelectorAll('[data-wikilink-broken]').forEach((el) => el.classList.add('text-danger'))
})

function onClick(event: MouseEvent): void {
  const target = (event.target as HTMLElement).closest('[data-wikilink-path]')
  if (!target) return
  event.preventDefault()
  const path = target.getAttribute('data-wikilink-path')
  if (path) void tabs.openTab(path)
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <DocumentBreadcrumb
      :path="props.path"
      :toc-visible="tocVisible"
      :mode="mode"
      @toggle-toc="tocVisible = !tocVisible"
      @update:mode="(next) => tabs.setViewMode(props.path, next)"
    />

    <div ref="scrollContainer" class="flex min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div class="min-w-0 flex-1 px-6 py-6">
        <p v-if="loading && !html" class="text-sm text-content-tertiary">{{ t('editor.loading') }}</p>
        <template v-else>
          <DocumentHeader :path="props.path" :title="title" :mtime="mtime" />
          <div ref="container" class="prose prose-sm mx-auto max-w-3xl" @click="onClick" v-html="html" />
        </template>
      </div>

      <Transition enter-active-class="transition duration-150 ease-out" leave-active-class="transition duration-100 ease-in" enter-from-class="opacity-0" leave-to-class="opacity-0">
        <TableOfContents v-if="tocVisible" :content="activeTab?.content ?? ''" :container="scrollContainer" />
      </Transition>
    </div>
  </div>
</template>
