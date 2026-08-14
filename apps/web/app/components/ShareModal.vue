<script setup lang="ts">
import { Link2, Copy, Trash2, Calendar, Eye, Lock, ShieldCheck } from '@lucide/vue'

const { isOpen, targetPath, closeShareDialog } = useShareLink()
const toast = useToast()

const loading = ref(false)
const saving = ref(false)

const isShared = ref(false)
const shareId = ref('')
const customId = ref('')
const password = ref('')
const maxViews = ref<number | ''>('')
const expiresAt = ref<string>('')
const requireLogin = ref(false)

const originalHasPassword = ref(false)

async function loadShareSettings() {
  if (!targetPath.value) return
  loading.value = true
  try {
    const data = await $fetch<any>('/api/share', { query: { path: targetPath.value } })
    if (data) {
      isShared.value = true
      shareId.value = data.id
      customId.value = data.id
      originalHasPassword.value = data.hasPassword
      password.value = ''
      maxViews.value = data.maxViews ?? ''
      expiresAt.value = data.expiresAt ? new Date(data.expiresAt).toISOString().split('T')[0] : ''
      requireLogin.value = data.requireLogin
    } else {
      isShared.value = false
      shareId.value = ''
      customId.value = ''
      originalHasPassword.value = false
      password.value = ''
      maxViews.value = ''
      expiresAt.value = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      requireLogin.value = false
    }
  } catch (e: any) {
    toast.show(e.data?.statusMessage || 'Fehler beim Laden', 'error')
  } finally {
    loading.value = false
  }
}

watch(isOpen, (open) => {
  if (open) {
    void loadShareSettings()
  }
})

function handleCancel() {
  closeShareDialog()
}

async function handleSave() {
  saving.value = true
  try {
    if (!isShared.value) {
      if (shareId.value) {
        await $fetch('/api/share', { method: 'DELETE', query: { path: targetPath.value } })
        toast.show('Freigabe deaktiviert', 'success')
      }
    } else {
      let expires = null
      if (expiresAt.value) {
        const d = new Date(expiresAt.value)
        if (!isNaN(d.getTime())) {
          expires = d.getTime()
        }
      }

      let payloadPassword = password.value
      // If user didn't change password but one exists, don't send anything to keep it
      if (!password.value && originalHasPassword.value) {
        payloadPassword = undefined as any
      }

      const res = await $fetch<{ id: string }>('/api/share', {
        method: 'PUT',
        body: {
          path: targetPath.value,
          customId: customId.value || undefined,
          password: payloadPassword,
          maxViews: typeof maxViews.value === 'number' && maxViews.value > 0 ? maxViews.value : undefined,
          expiresAt: expires,
          requireLogin: requireLogin.value
        }
      })
      shareId.value = res.id
      toast.show('Freigabe gespeichert', 'success')
    }
    closeShareDialog()
  } catch (e: any) {
    toast.show(e.data?.statusMessage || 'Fehler beim Speichern', 'error')
  } finally {
    saving.value = false
  }
}

async function handleCopy() {
  if (!shareId.value) return
  const url = `${window.location.origin}/share/${shareId.value}`
  try {
    await navigator.clipboard.writeText(url)
    toast.show('Link kopiert', 'success')
  } catch {
    toast.show('Fehler beim Kopieren', 'error')
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) handleCancel()
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition appear enter-active-class="transition duration-150 ease-out" leave-active-class="transition duration-100 ease-in" enter-from-class="opacity-0" leave-to-class="opacity-0">
      <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/40" @click="handleCancel">
        <Transition appear enter-active-class="transition duration-150 ease-out" leave-active-class="transition duration-100 ease-in" enter-from-class="scale-95 opacity-0" leave-to-class="scale-95 opacity-0">
          <div class="mx-4 flex max-h-dialog w-full max-w-md flex-col rounded-xl border border-border-strong bg-surface-1 shadow-float" @click.stop>
            <div class="shrink-0 border-b border-border px-4 py-3">
              <h2 class="flex items-center gap-2 font-semibold text-content-primary">
                <Link2 class="h-5 w-5 text-content-tertiary" stroke-width="1.5" />
                Dokument freigeben
              </h2>
            </div>

            <div class="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
              <div v-if="loading" class="text-sm text-content-tertiary">Lädt...</div>
              
              <template v-else>
                <div class="flex items-center justify-between">
                  <div>
                    <label class="text-sm font-medium text-content-primary">Externen Link aktivieren</label>
                    <p class="text-xs text-content-tertiary">Erlaubt den Zugriff über einen öffentlichen Link.</p>
                  </div>
                  <label class="relative inline-flex cursor-pointer items-center">
                    <input type="checkbox" v-model="isShared" class="peer sr-only">
                    <div class="peer h-6 w-11 rounded-full bg-surface-3 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-border after:bg-white after:transition-all after:content-[''] peer-checked:bg-accent peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent/50 rtl:peer-checked:after:-translate-x-full"></div>
                  </label>
                </div>

                <div v-if="isShared" class="space-y-4">
                  <div class="rounded-md border border-accent/20 bg-accent/5 p-3">
                    <p class="mb-2 text-xs font-medium text-accent">Freigabe-Link (Speichern erforderlich)</p>
                    <div class="flex items-center gap-2">
                      <input
                        type="text"
                        :value="shareId ? `${window?.location?.origin || ''}/share/${shareId}` : 'Wird beim Speichern generiert...'"
                        readonly
                        class="w-full rounded-md border border-border-strong bg-surface-2 px-3 py-1.5 text-sm text-content-primary"
                      />
                      <button
                        v-if="shareId"
                        type="button"
                        class="shrink-0 rounded-md bg-surface-2 p-1.5 text-content-secondary transition-colors hover:bg-surface-3 hover:text-content-primary"
                        title="Link kopieren"
                        @click="handleCopy"
                      >
                        <Copy class="h-4 w-4" stroke-width="1.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label class="mb-1 block text-sm font-medium text-content-secondary">Custom ID (Optional)</label>
                    <div class="relative">
                      <input
                        v-model="customId"
                        type="text"
                        placeholder="Zufällige ID generieren"
                        class="w-full rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-sm text-content-primary transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-accent/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label class="mb-1 block text-sm font-medium text-content-secondary flex items-center gap-1.5">
                      <Lock class="h-4 w-4" stroke-width="1.5"/>
                      Passwort
                    </label>
                    <input
                      v-model="password"
                      type="password"
                      :placeholder="originalHasPassword ? 'Passwort unverändert (leer lassen zum Behalten)' : 'Kein Passwort (optional)'"
                      class="w-full rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-sm text-content-primary transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-accent/50"
                    />
                    <p v-if="originalHasPassword && !password" class="mt-1 text-xs text-content-tertiary">
                      Ein Passwort ist aktuell gesetzt.
                    </p>
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="mb-1 block text-sm font-medium text-content-secondary flex items-center gap-1.5">
                        <Calendar class="h-4 w-4" stroke-width="1.5"/>
                        Ablaufdatum
                      </label>
                      <input
                        v-model="expiresAt"
                        type="date"
                        class="w-full rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-sm text-content-primary transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-accent/50"
                      />
                    </div>
                    <div>
                      <label class="mb-1 block text-sm font-medium text-content-secondary flex items-center gap-1.5">
                        <Eye class="h-4 w-4" stroke-width="1.5"/>
                        Max. Aufrufe
                      </label>
                      <input
                        v-model.number="maxViews"
                        type="number"
                        min="1"
                        placeholder="Unbegrenzt"
                        class="w-full rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-sm text-content-primary transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-accent/50"
                      />
                    </div>
                  </div>

                  <div class="flex items-center justify-between border-t border-border pt-4">
                    <div class="flex items-center gap-1.5">
                      <ShieldCheck class="h-4 w-4 text-content-secondary" stroke-width="1.5" />
                      <div>
                        <label class="text-sm font-medium text-content-primary">Login erforderlich</label>
                        <p class="text-xs text-content-tertiary">Nur angemeldete Nutzer können zugreifen</p>
                      </div>
                    </div>
                    <label class="relative inline-flex cursor-pointer items-center">
                      <input type="checkbox" v-model="requireLogin" class="peer sr-only">
                      <div class="peer h-6 w-11 rounded-full bg-surface-3 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-border after:bg-white after:transition-all after:content-[''] peer-checked:bg-accent peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent/50 rtl:peer-checked:after:-translate-x-full"></div>
                    </label>
                  </div>
                </div>
              </template>
            </div>

            <div class="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
              <button
                type="button"
                class="rounded-md border border-border-strong px-4 py-2 text-sm text-content-primary transition-colors duration-150 hover:bg-white/[0.04] focus:outline-none focus:ring-1 focus:ring-accent/50"
                @click="handleCancel"
              >
                Abbrechen
              </button>
              <button
                type="button"
                :disabled="saving || loading"
                class="rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors duration-150 hover:bg-accent/90 focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
                @click="handleSave"
              >
                {{ saving ? 'Speichert...' : 'Speichern' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
