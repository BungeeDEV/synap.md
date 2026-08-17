<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps<{
  frontmatter: Record<string, any> | null
}>()

const hasFrontmatter = computed(() => {
  return props.frontmatter && Object.keys(props.frontmatter).length > 0
})

const title = computed(() => props.frontmatter?.title)
const aliases = computed(() => {
  const val = props.frontmatter?.aliases
  if (Array.isArray(val)) return val
  if (typeof val === 'string') return [val]
  return []
})
const tags = computed(() => {
  const val = props.frontmatter?.tags
  if (Array.isArray(val)) return val
  if (typeof val === 'string') return [val]
  return []
})

const otherProperties = computed(() => {
  if (!props.frontmatter) return []
  return Object.entries(props.frontmatter)
    .filter(([key]) => !['title', 'aliases', 'tags'].includes(key))
    .map(([key, value]) => ({ key, value }))
})
</script>

<template>
  <div v-if="hasFrontmatter" class="properties-panel border border-base-200 rounded-lg p-4 mb-6 bg-base-100/50">
    <div class="text-sm font-semibold mb-3 text-base-content/80">{{ t('editor.properties') }}</div>
    <div class="grid grid-cols-[120px_1fr] gap-2 text-sm">
      <template v-if="title">
        <div class="text-base-content/60 font-medium py-1">title</div>
        <div class="py-1">{{ title }}</div>
      </template>
      
      <template v-if="aliases.length > 0">
        <div class="text-base-content/60 font-medium py-1">aliases</div>
        <div class="flex flex-wrap gap-1 py-1">
          <span v-for="alias in aliases" :key="alias" class="bg-base-200 px-2 py-0.5 rounded text-xs">
            {{ alias }}
          </span>
        </div>
      </template>

      <template v-if="tags.length > 0">
        <div class="text-base-content/60 font-medium py-1">tags</div>
        <div class="flex flex-wrap gap-1 py-1">
          <span v-for="tag in tags" :key="tag" class="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">
            {{ tag }}
          </span>
        </div>
      </template>

      <template v-for="prop in otherProperties" :key="prop.key">
        <div class="text-base-content/60 font-medium py-1">{{ prop.key }}</div>
        <div class="py-1 break-words">
          <template v-if="Array.isArray(prop.value)">
            <span v-for="(v, i) in prop.value" :key="i" class="bg-base-200 px-2 py-0.5 rounded text-xs mr-1 mb-1 inline-block">
              {{ String(v) }}
            </span>
          </template>
          <template v-else-if="typeof prop.value === 'object' && prop.value !== null">
            {{ JSON.stringify(prop.value) }}
          </template>
          <template v-else>
            {{ String(prop.value) }}
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.properties-panel {
  container-type: inline-size;
}
</style>
