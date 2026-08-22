<script setup lang="ts">
import { CircleCheck, FileQuestion, Loader2, RefreshCw, Unlink } from '@lucide/vue'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()
const tabs = useTabsStore()

interface BrokenLink {
  path: string
  title: string
  target: string
  occurrences: number
}

interface OrphanedNote {
  path: string
  title: string
}

interface VaultHealthReport {
  brokenLinks: BrokenLink[]
  orphanedNotes: OrphanedNote[]
  checkedAt: string
}

const report = ref<VaultHealthReport | null>(null)
const loading = ref(true)
const reindexing = ref(false)
const error = ref(false)

const isHealthy = computed(() => report.value !== null && report.value.brokenLinks.length === 0 && report.value.orphanedNotes.length === 0)

const checkedAtLabel = computed(() => {
  if (!report.value) return ''
  return new Date(report.value.checkedAt).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
})

async function load(): Promise<void> {
  loading.value = true
  error.value = false
  try {
    report.value = await $fetch<VaultHealthReport>('/api/vault/health')
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

void load()

const { show } = useToast()

async function reindexAndRecheck(): Promise<void> {
  if (reindexing.value) return
  reindexing.value = true
  try {
    const result = await $fetch<{ total: number, indexed: number }>('/api/admin/reindex', { method: 'POST' })
    show(t('settings.healthReindexDone', { indexed: result.indexed, total: result.total }))
    await load()
  } catch {
    show(t('settings.healthReindexFailed'), 'error')
  } finally {
    reindexing.value = false
  }
}

async function openNote(path: string): Promise<void> {
  await tabs.openTab(path)
  await navigateTo('/')
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="border-b border-border pb-2 text-xl font-semibold">{{ t('settings.healthTitle') }}</h2>
      <p class="mt-2 text-sm text-content-tertiary">{{ t('settings.healthSubtitle') }}</p>
    </div>

    <SkeletonList v-if="loading" :rows="4" />

    <div v-else-if="error" class="flex flex-col items-center gap-3 py-10 text-center">
      <p class="text-sm text-content-tertiary">{{ t('settings.healthLoadFailed') }}</p>
      <button type="button" class="rounded-md border border-border-strong px-3 py-1.5 text-sm text-content-secondary transition-colors duration-150 hover:bg-white/[0.04]" @click="load">
        {{ t('settings.healthRetry') }}
      </button>
    </div>

    <template v-else-if="report">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-content-tertiary">{{ t('settings.healthCheckedAt', { time: checkedAtLabel }) }}</p>
        <button
          type="button"
          :disabled="loading"
          class="flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-sm text-content-secondary transition-colors duration-150 hover:bg-white/[0.04] disabled:pointer-events-none disabled:opacity-50"
          @click="load"
        >
          <RefreshCw class="h-3.5 w-3.5" stroke-width="1.5" />
          {{ t('settings.healthRefresh') }}
        </button>
      </div>

      <div v-if="isHealthy" class="flex flex-col items-center gap-2 py-12 text-center">
        <CircleCheck class="h-7 w-7 text-success" stroke-width="1.5" />
        <p class="text-base text-content-tertiary">{{ t('settings.healthAllGood') }}</p>
      </div>

      <template v-else>
        <div class="flex flex-wrap items-center gap-2">
          <span class="rounded-full bg-danger/10 px-2.5 py-1 text-sm font-medium text-danger">
            {{ report.brokenLinks.length }} · {{ t('settings.healthBrokenLinksTitle') }}
          </span>
          <span class="rounded-full bg-white/[0.06] px-2.5 py-1 text-sm font-medium text-content-secondary">
            {{ report.orphanedNotes.length }} · {{ t('settings.healthOrphanedNotesTitle') }}
          </span>
        </div>

        <div v-if="report.brokenLinks.length">
          <h3 class="mb-1.5 text-sm font-medium tracking-wider text-content-tertiary uppercase">{{ t('settings.healthBrokenLinksTitle') }}</h3>
          <ul class="divide-y divide-border overflow-hidden rounded-lg border border-border">
            <li v-for="item in report.brokenLinks" :key="`${item.path}::${item.target}`">
              <button
                type="button"
                class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-white/[0.04]"
                @click="openNote(item.path)"
              >
                <Unlink class="h-4 w-4 shrink-0 text-danger" stroke-width="1.5" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-base text-content-primary">{{ item.title }}</span>
                  <span class="block truncate text-sm text-content-tertiary">
                    {{ item.target }}<template v-if="item.occurrences > 1"> · ×{{ item.occurrences }}</template>
                  </span>
                </span>
              </button>
            </li>
          </ul>
        </div>
        <p v-else class="text-sm text-content-tertiary">{{ t('settings.healthNoBrokenLinks') }}</p>

        <div v-if="report.orphanedNotes.length">
          <h3 class="mb-1.5 text-sm font-medium tracking-wider text-content-tertiary uppercase">{{ t('settings.healthOrphanedNotesTitle') }}</h3>
          <ul class="divide-y divide-border overflow-hidden rounded-lg border border-border">
            <li v-for="item in report.orphanedNotes" :key="item.path">
              <button
                type="button"
                class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-white/[0.04]"
                @click="openNote(item.path)"
              >
                <FileQuestion class="h-4 w-4 shrink-0 text-content-tertiary" stroke-width="1.5" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-base text-content-primary">{{ item.title }}</span>
                  <span class="block truncate text-sm text-content-tertiary">{{ item.path }}</span>
                </span>
              </button>
            </li>
          </ul>
        </div>
        <p v-else class="text-sm text-content-tertiary">{{ t('settings.healthNoOrphanedNotes') }}</p>
      </template>

      <div class="flex items-center gap-2 border-t border-border pt-4 text-sm text-content-tertiary">
        <span>{{ t('settings.healthReindexHint') }}</span>
        <button
          type="button"
          :disabled="reindexing"
          class="flex items-center gap-1.5 font-medium text-content-secondary underline decoration-content-tertiary/40 underline-offset-2 transition-colors duration-150 hover:text-content-primary disabled:pointer-events-none disabled:opacity-50"
          @click="reindexAndRecheck"
        >
          <Loader2 v-if="reindexing" class="h-3.5 w-3.5 animate-spin" stroke-width="1.5" />
          {{ reindexing ? t('settings.healthReindexing') : t('settings.healthReindexAction') }}
        </button>
      </div>
    </template>
  </div>
</template>
