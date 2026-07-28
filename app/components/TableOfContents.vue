<script setup lang="ts">
import { extractHeadings } from '~/utils/extractHeadings'

// `container` is the rendered document's scrollable ancestor (NoteReader's
// scroll div) - reused both as the IntersectionObserver root and as the
// element headings are queried from, since it contains the v-html'd prose.
const props = defineProps<{ content: string, container: HTMLElement | null }>()

const INDENT_CLASSES: Record<number, string> = {
  1: 'pl-2',
  2: 'pl-4',
  3: 'pl-6',
  4: 'pl-8',
  5: 'pl-10',
  6: 'pl-12'
}

// Parsed from the raw Markdown (same extractHeadings.ts OutlinePanel.vue
// uses), not the rendered HTML - the rendered <h1>-<h6> elements are only
// used below to resolve scroll targets, matched by index since remark-rehype
// emits exactly one heading element per Markdown heading node in document
// order (extractHeadings already skips fenced code blocks the same way the
// Markdown parser does).
const headings = computed(() => extractHeadings(props.content))
const activeIndex = ref(0)
let observer: IntersectionObserver | null = null

function headingElements(): HTMLElement[] {
  if (!props.container) return []
  return Array.from(props.container.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'))
}

function setupObserver(): void {
  observer?.disconnect()
  observer = null
  const elements = headingElements()
  if (!props.container || !elements.length) return

  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting)
      if (!visible.length) return
      const topMost = visible.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b))
      const index = elements.indexOf(topMost.target as HTMLElement)
      if (index !== -1) activeIndex.value = index
    },
    // Only counts a heading as "current" once it's within the top 30% of the
    // viewport, rather than as soon as it's technically visible at the
    // bottom - otherwise the next heading down would win the moment it
    // scrolls into view at all.
    { root: props.container, rootMargin: '0px 0px -70% 0px', threshold: 0 }
  )
  elements.forEach((element) => observer!.observe(element))
}

watch(() => [props.container, headings.value.length] as const, () => nextTick(setupObserver), { immediate: true })
onBeforeUnmount(() => observer?.disconnect())

function jumpTo(index: number): void {
  headingElements()[index]?.scrollIntoView({ block: 'start' })
}
</script>

<template>
  <nav
    v-if="headings.length"
    class="sticky top-0 hidden w-56 shrink-0 self-start overflow-y-auto overscroll-contain px-3 py-4 text-sm lg:block"
  >
    <p class="mb-2 px-2 text-xs font-medium tracking-wider text-content-tertiary uppercase">
      Contents
    </p>
    <ul class="space-y-1">
      <li v-for="(heading, index) in headings" :key="`${heading.line}-${index}`">
        <button
          type="button"
          class="block w-full truncate rounded-md px-2 py-1 text-left transition-colors duration-150"
          :class="[INDENT_CLASSES[heading.level], index === activeIndex ? 'font-medium text-accent' : 'text-content-tertiary hover:text-content-secondary']"
          @click="jumpTo(index)"
        >
          {{ heading.text }}
        </button>
      </li>
    </ul>
  </nav>
</template>
