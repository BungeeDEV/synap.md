<script setup lang="ts">
import { Lock, FileText, ArrowRight } from 'lucide-vue-next'

const route = useRoute()
const shareId = route.params.id as string

const loading = ref(true)
const errorMsg = ref('')
const requiresPassword = ref(false)
const passwordInput = ref('')

const documentTitle = ref('')
const documentHtml = ref('')

async function fetchDocument(password?: string) {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await $fetch<any>(`/api/shared/${shareId}`, {
      method: password ? 'POST' : 'GET',
      body: password ? { password } : undefined
    })

    if (res.requiresPassword) {
      requiresPassword.value = true
      return
    }

    requiresPassword.value = false
    documentTitle.value = res.title || 'Freigegebenes Dokument'
    documentHtml.value = res.html || ''
    
    // Add title to page
    useHead({ title: documentTitle.value })
  } catch (err: any) {
    if (err.statusCode === 401) {
      if (password) {
        errorMsg.value = 'Falsches Passwort.'
      } else {
        requiresPassword.value = true
      }
    } else if (err.statusCode === 410) {
      errorMsg.value = 'Dieser Link ist abgelaufen oder hat die maximale Anzahl an Aufrufen erreicht.'
    } else if (err.statusCode === 404) {
      errorMsg.value = 'Dieser Link existiert nicht.'
    } else {
      errorMsg.value = err.data?.statusMessage || 'Ein Fehler ist aufgetreten.'
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void fetchDocument()
})

function submitPassword() {
  if (!passwordInput.value) return
  void fetchDocument(passwordInput.value)
}
</script>

<template>
  <div class="min-h-screen bg-surface-1 text-content-primary">
    <!-- Header -->
    <header class="flex h-14 shrink-0 items-center border-b border-border bg-surface-2/80 px-4 backdrop-blur-md">
      <div class="flex items-center gap-2">
        <div class="flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 text-accent">
          <FileText class="h-5 w-5" stroke-width="1.5" />
        </div>
        <span class="font-medium truncate">{{ documentTitle || 'Synap.md' }}</span>
      </div>
    </header>

    <main class="mx-auto max-w-4xl p-6">
      <div v-if="loading && !requiresPassword && !errorMsg" class="flex items-center justify-center py-20 text-content-tertiary">
        Dokument wird geladen...
      </div>

      <div v-else-if="errorMsg && !requiresPassword" class="mx-auto mt-20 max-w-md rounded-xl border border-danger/20 bg-danger/5 p-6 text-center">
        <p class="text-danger">{{ errorMsg }}</p>
      </div>

      <div v-else-if="requiresPassword" class="mx-auto mt-20 max-w-sm rounded-xl border border-border-strong bg-surface-2 p-6 shadow-sm">
        <div class="mb-6 flex flex-col items-center text-center">
          <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-3">
            <Lock class="h-6 w-6 text-content-secondary" stroke-width="1.5" />
          </div>
          <h2 class="text-lg font-medium text-content-primary">Passwort erforderlich</h2>
          <p class="mt-1 text-sm text-content-tertiary">Dieses Dokument ist passwortgeschützt.</p>
        </div>

        <form @submit.prevent="submitPassword" class="space-y-4">
          <div>
            <input
              v-model="passwordInput"
              type="password"
              placeholder="Passwort eingeben"
              class="w-full rounded-md border border-border-strong bg-surface-1 px-3 py-2 text-sm text-content-primary transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-accent/50"
              autofocus
            />
            <p v-if="errorMsg" class="mt-2 text-xs text-danger">{{ errorMsg }}</p>
          </div>
          <button
            type="submit"
            :disabled="!passwordInput || loading"
            class="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors duration-150 hover:bg-accent/90 focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{ loading ? 'Prüft...' : 'Entsperren' }}
            <ArrowRight v-if="!loading" class="h-4 w-4" stroke-width="1.5" />
          </button>
        </form>
      </div>

      <div v-else-if="documentHtml" class="prose prose-sm mx-auto max-w-3xl rounded-xl border border-border bg-surface-1 p-8 shadow-sm">
        <h1 class="mb-8 text-3xl font-bold">{{ documentTitle }}</h1>
        <div v-html="documentHtml"></div>
      </div>
    </main>
  </div>
</template>
