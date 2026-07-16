<script setup lang="ts">
const props = defineProps<{ path: string }>()

const tabs = useTabsStore()
const html = ref('')
const loading = ref(false)
const container = ref<HTMLDivElement | null>(null)

// Re-render whenever the on-disk content we know about changes (a save
// completing, or "externe Version laden" during a conflict) - both update
// lastKnownMtime, which render.get.ts's source (the file on disk) tracks.
const mtime = computed(() => tabs.tabs.find((t) => t.path === props.path)?.lastKnownMtime ?? null)

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
  <div class="h-full overflow-y-auto overscroll-contain px-6 py-6">
    <p v-if="loading && !html" class="text-sm text-content-tertiary">
      Lädt…
    </p>
    <div v-else ref="container" class="prose prose-sm max-w-none" @click="onClick" v-html="html" />
  </div>
</template>
