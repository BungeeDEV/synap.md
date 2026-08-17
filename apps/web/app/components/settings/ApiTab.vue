<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { Plus, Trash2, Key, AlertCircle } from '@lucide/vue'

const { data, refresh } = await useFetch('/api/settings/token')
const tokens = computed(() => data.value?.tokens ?? [])

const newName = ref('')
const createdToken = ref<string | null>(null)
const errorMsg = ref('')

async function createToken() {
  if (!newName.value.trim()) return
  try {
    errorMsg.value = ''
    const res = await $fetch('/api/settings/token', {
      method: 'POST',
      body: { name: newName.value.trim() }
    })
    createdToken.value = res.token
    newName.value = ''
    await refresh()
  } catch (err: any) {
    errorMsg.value = err.message || 'Fehler beim Erstellen des Tokens'
  }
}

async function deleteToken(id: number) {
  if (!confirm('Soll dieser Token wirklich gelöscht werden? Externe Clients, die ihn nutzen, verlieren sofort den Zugriff.')) return
  try {
    await $fetch(`/api/settings/token/${id}`, { method: 'DELETE' })
    await refresh()
  } catch (err: any) {
    alert(err.message || 'Fehler beim Löschen des Tokens')
  }
}
</script>

<template>
  <div class="space-y-8">
    <div>
      <h2 class="mb-1 text-lg font-medium text-content-primary">{{ t('settings.apiTokensTitle') }}</h2>
      <p class="text-sm text-content-tertiary">{{ t('settings.apiTokensDesc') }}</p>
    </div>

    <!-- Neuer Token -->
    <div class="space-y-4 rounded-xl border border-border bg-surface-1 p-5 shadow-sm">
      <h3 class="font-medium text-content-primary">{{ t('settings.createTokenButton') }}</h3>
      
      <div v-if="createdToken" class="rounded-lg bg-orange-500/10 p-4 border border-orange-500/20">
        <div class="mb-2 flex items-start gap-3">
          <AlertCircle class="h-5 w-5 text-orange-500 shrink-0 mt-0.5" stroke-width="1.5" />
          <div>
            <h4 class="font-medium text-orange-500">{{ t('settings.tokenGenerated') }}</h4>
            <p class="text-sm text-orange-500/80 mt-1">{{ t('settings.copyTokenMsg1') }}<strong>{{ t('settings.copyTokenMsgNow') }}</strong>{{ t('settings.copyTokenMsg2') }}</p>
          </div>
        </div>
        <div class="mt-4 flex items-center gap-2">
          <code class="flex-1 rounded-md bg-black/20 p-2.5 text-sm font-mono text-content-primary break-all select-all">{{ createdToken }}</code>
          <button type="button" class="shrink-0 rounded-md bg-orange-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-500" @click="createdToken = null">{{ t('settings.done') }}</button>
        </div>
      </div>
      
      <form v-else @submit.prevent="createToken" class="flex items-center gap-3">
        <input
          v-model="newName"
          type="text"
          placeholder="Token-Name (z.B. Mein MacBook)"
          class="flex-1 rounded-md border border-border bg-surface-2 px-3 py-2.5 text-content-primary placeholder:text-content-tertiary focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          required
        />
        <button
          type="submit"
          :disabled="!newName.trim()"
          class="flex shrink-0 items-center gap-2 rounded-md bg-orange-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
        >
          <Plus class="h-4 w-4" stroke-width="1.5" />{{ t('settings.createButton') }}</button>
      </form>
      <p v-if="errorMsg && !createdToken" class="text-sm text-red-500">{{ errorMsg }}</p>
    </div>

    <!-- Token-Liste -->
    <div>
      <h3 class="mb-4 font-medium text-content-primary">{{ t('settings.activeTokens') }}</h3>
      <div class="rounded-xl border border-border bg-surface-1 overflow-hidden shadow-sm">
        <div v-if="tokens.length === 0" class="p-8 text-center text-content-tertiary">
          <Key class="mx-auto mb-3 h-8 w-8 opacity-50" stroke-width="1.5" />
          <p>{{ t('settings.noApiTokens') }}</p>
        </div>
        
        <ul v-else class="divide-y divide-border">
          <li v-for="token in tokens" :key="token.id" class="flex items-center justify-between p-4 transition-colors hover:bg-white/[0.02]">
            <div>
              <div class="font-medium text-content-primary">{{ token.name }}</div>
              <div class="mt-1 flex items-center gap-4 text-xs text-content-tertiary">
                <span>Erstellt: {{ new Date(token.created_at).toLocaleDateString() }}</span>
                <span v-if="token.last_used_at">Zuletzt genutzt: {{ new Date(token.last_used_at).toLocaleDateString() }}</span>
                <span v-else>{{ t('settings.neverUsed') }}</span>
              </div>
            </div>
            
            <button
              type="button"
              class="rounded-md p-2 text-content-tertiary transition-colors duration-150 hover:bg-red-500/10 hover:text-red-500"
              title="Token widerrufen"
              @click="deleteToken(token.id)"
            >
              <Trash2 class="h-5 w-5" stroke-width="1.5" />
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
