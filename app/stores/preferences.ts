import { DEFAULT_PREFERENCES, type DailyNotesPreferences, type EditorPreferences } from '#shared/preferences'

// Mirrors preferences.put.ts's body shape: every top-level field is
// independently optional, and dailyNotes' own fields are independently
// optional too (a folder-only save shouldn't have to resend dateFormat).
type PreferencesPatch = Partial<Omit<EditorPreferences, 'dailyNotes'>> & { dailyNotes?: Partial<DailyNotesPreferences> }

/**
 * Loaded once (see app.vue) and read by tabs.openTab (default view mode for
 * newly opened tabs) and NoteEditor (font size / line wrap for newly
 * mounted editor instances) - never retroactively applied to tabs/editors
 * that already exist, per the settings spec.
 */
export const usePreferencesStore = defineStore('preferences', () => {
  const preferences = ref<EditorPreferences>({ ...DEFAULT_PREFERENCES })
  const loaded = ref(false)

  async function load(): Promise<void> {
    if (loaded.value) return
    // Called fire-and-forget from app.vue's loggedIn watcher - swallow
    // failures (e.g. a request racing ahead of a not-yet-valid session)
    // instead of throwing an unhandled rejection; callers just keep the
    // defaults and can retry via another loggedIn transition.
    try {
      preferences.value = await $fetch<EditorPreferences>('/api/settings/preferences')
      loaded.value = true
    } catch (err) {
      console.error('preferences.ts: failed to load preferences', err)
    }
  }

  async function update(patch: PreferencesPatch): Promise<void> {
    preferences.value = await $fetch<EditorPreferences>('/api/settings/preferences', { method: 'PUT', body: patch })
  }

  return { preferences, loaded, load, update }
})
