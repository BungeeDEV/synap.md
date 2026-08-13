<script setup lang="ts">
import { FilePlus, Trash2 } from '@lucide/vue'
import { formatDate } from '#shared/formatDate'
import { validateRawName } from '#shared/validateFileName'

interface TemplateInfo {
  name: string
  path: string
}

const preferences = usePreferencesStore()
const tabs = useTabsStore()
const { show } = useToast()

// --- Daily Notes section ---

const folder = ref(preferences.preferences.dailyNotes.folder)
const dateFormat = ref(preferences.preferences.dailyNotes.dateFormat)
const savingDailyNotes = ref(false)

watch(() => preferences.preferences.dailyNotes, (value) => {
  folder.value = value.folder
  dateFormat.value = value.dateFormat
})

const todayPreview = computed(() => formatDate(new Date(), dateFormat.value))

async function saveDailyNotesSettings(): Promise<void> {
  savingDailyNotes.value = true
  try {
    await preferences.update({ dailyNotes: { folder: folder.value, dateFormat: dateFormat.value } })
    show('Daily-Notes-Einstellungen gespeichert')
  } catch {
    show('Speichern fehlgeschlagen', 'error')
  } finally {
    savingDailyNotes.value = false
  }
}

async function setDefaultTemplate(event: Event): Promise<void> {
  const value = (event.target as HTMLSelectElement).value
  try {
    await preferences.update({ dailyNotes: { templateName: value === '' ? null : value } })
    show('Einstellung gespeichert')
  } catch {
    show('Einstellung konnte nicht gespeichert werden', 'error')
  }
}

// --- Vorlagen verwalten section ---

const templates = ref<TemplateInfo[]>([])
const loadingTemplates = ref(true)
const pendingDelete = ref<TemplateInfo | null>(null)

const creatingTemplate = ref(false)
const newTemplateName = ref('Untitled')
const newTemplateError = ref<string | null>(null)

async function loadTemplates(): Promise<void> {
  loadingTemplates.value = true
  try {
    templates.value = await $fetch<TemplateInfo[]>('/api/templates/list')
  } finally {
    loadingTemplates.value = false
  }
}

void loadTemplates()

function errorMessageOf(err: unknown, fallback: string): string {
  const statusMessage = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
  return statusMessage ?? fallback
}

function startCreateTemplate(): void {
  creatingTemplate.value = true
  newTemplateName.value = 'Untitled'
  newTemplateError.value = null
}

function cancelCreateTemplate(): void {
  creatingTemplate.value = false
}

async function submitCreateTemplate(): Promise<void> {
  const rawError = validateRawName(newTemplateName.value)
  if (rawError) {
    newTemplateError.value = rawError
    return
  }

  try {
    await $fetch('/api/templates/create', { method: 'POST', body: { name: newTemplateName.value.trim() } })
    creatingTemplate.value = false
    await loadTemplates()
    show('Vorlage erstellt')
  } catch (err) {
    newTemplateError.value = errorMessageOf(err, 'Vorlage konnte nicht erstellt werden')
  }
}

async function openTemplate(template: TemplateInfo): Promise<void> {
  await tabs.openTab(template.path)
  await navigateTo('/')
}

async function confirmDeleteTemplate(): Promise<void> {
  if (!pendingDelete.value) return
  const template = pendingDelete.value
  pendingDelete.value = null

  try {
    await $fetch('/api/templates/delete', { method: 'POST', body: { path: template.path } })
    tabs.closeTab(template.path)
    await loadTemplates()
    show('Vorlage gelöscht')
  } catch {
    show('Löschen fehlgeschlagen', 'error')
  }
}

const templateDropdownOptions = computed(() => templates.value)
</script>

<template>
  <div class="space-y-8">
    <section>
      <h2 class="mb-3 border-b border-border pb-2 text-xl font-semibold">
        Daily Notes
      </h2>

      <div class="flex flex-col gap-4 rounded-lg bg-surface-1 p-4 md:max-w-sm md:gap-3 md:bg-transparent md:p-0">
        <label class="flex flex-col gap-1 text-sm text-content-secondary">
          Ordner
          <input
            v-model="folder"
            type="text"
            class="min-h-12 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-base text-content-primary transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-accent/50 md:min-h-0 md:text-sm"
          >
        </label>

        <label class="flex flex-col gap-1 text-sm text-content-secondary">
          Format
          <input
            v-model="dateFormat"
            type="text"
            class="min-h-12 w-full rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-base text-content-primary transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-accent/50 md:min-h-0 md:text-sm"
          >
        </label>
        <p class="text-sm text-content-tertiary">
          Heute: <span class="font-mono text-content-secondary">{{ todayPreview }}.md</span>
        </p>

        <button
          type="button"
          :disabled="savingDailyNotes"
          class="min-h-12 w-full rounded-md bg-accent px-4 py-2 text-white transition-colors duration-150 hover:bg-accent/90 focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-0 md:w-auto md:self-start"
          @click="saveDailyNotesSettings"
        >
          Speichern
        </button>

        <label class="flex flex-col gap-1 text-sm text-content-secondary">
          Standard-Vorlage
          <select
            :value="preferences.preferences.dailyNotes.templateName ?? ''"
            class="min-h-12 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-base text-content-primary transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-accent/50 md:min-h-0 md:text-sm"
            @change="setDefaultTemplate"
          >
            <option value="">
              Keine Vorlage
            </option>
            <option v-for="template in templateDropdownOptions" :key="template.path" :value="template.name">
              {{ template.name }}
            </option>
          </select>
        </label>
      </div>
    </section>

    <section>
      <h2 class="mb-3 flex items-center justify-between border-b border-border pb-2 text-xl font-semibold">
        Vorlagen verwalten
        <button
          type="button"
          class="flex min-h-12 items-center gap-1.5 rounded-md px-4 py-2 text-base font-normal text-content-secondary transition-colors duration-150 hover:bg-white/[0.04] md:min-h-0 md:px-3 md:py-1.5"
          @click="startCreateTemplate"
        >
          <FilePlus class="h-5 w-5" stroke-width="1.5" />
          Neue Vorlage
        </button>
      </h2>

      <p v-if="loadingTemplates" class="text-sm text-content-tertiary">
        Lädt…
      </p>

      <ul v-else class="divide-y divide-border">
        <li v-if="creatingTemplate" class="flex items-center gap-1.5 py-2">
          <TreeInlineInput
            v-model="newTemplateName"
            :error="newTemplateError"
            @submit="submitCreateTemplate"
            @cancel="cancelCreateTemplate"
          />
        </li>

        <li v-if="!creatingTemplate && templates.length === 0" class="flex flex-col items-center gap-2 py-12 text-center">
          <FilePlus class="h-7 w-7 text-content-tertiary" stroke-width="1.5" />
          <p class="text-base text-content-tertiary">
            Noch keine Vorlagen vorhanden.
          </p>
        </li>

        <li v-for="template in templates" :key="template.path" class="flex items-center justify-between gap-4 py-2">
          <button
            type="button"
            class="min-h-12 min-w-0 flex-1 truncate rounded-md px-3 py-2 text-left text-base text-content-primary transition-colors duration-150 hover:bg-white/[0.04] md:min-h-0 md:px-2.5 md:py-1.5"
            @click="openTemplate(template)"
          >
            {{ template.name }}
          </button>
          <button
            type="button"
            title="Vorlage löschen"
            class="min-h-12 shrink-0 rounded-md p-3 text-content-tertiary transition-colors duration-150 hover:bg-danger/10 hover:text-danger md:min-h-0 md:p-2.5"
            @click="pendingDelete = template"
          >
            <Trash2 class="h-5 w-5" stroke-width="1.5" />
          </button>
        </li>
      </ul>
    </section>

    <ConfirmDialog
      v-if="pendingDelete"
      title="Vorlage löschen"
      :message="`„${pendingDelete.name}“ wird unwiderruflich gelöscht.`"
      confirm-label="Löschen"
      @confirm="confirmDeleteTemplate"
      @cancel="pendingDelete = null"
    />
  </div>
</template>
