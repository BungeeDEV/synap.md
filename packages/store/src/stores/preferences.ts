import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useSynapApi } from '../api'
import { DEFAULT_PREFERENCES, type DailyNotesPreferences, type EditorPreferences } from '../preferences_types'

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
      preferences.value = await useSynapApi().fetchPreferences()
      loaded.value = true
    } catch (err) {
      console.error('preferences.ts: failed to load preferences', err)
    }
  }

  // Bumped on every update() call; a response only gets applied if it's
  // still the newest one in flight, so an older request that happens to
  // resolve after a newer one (e.g. rapid theme toggling) can't clobber it.
  let updateToken = 0

  async function update(patch: PreferencesPatch): Promise<void> {
    const previous = preferences.value
    const token = ++updateToken

    // Apply optimistically, mirroring the server's merge shape (see
    // preferences.put.ts) - a theme toggle or font-size drag should reflect
    // immediately instead of waiting for the round trip.
    preferences.value = {
      ...previous,
      ...patch,
      dailyNotes: patch.dailyNotes ? { ...previous.dailyNotes, ...patch.dailyNotes } : previous.dailyNotes
    }

    try {
      const result = await useSynapApi().updatePreferences(patch)
      if (token === updateToken) preferences.value = result
    } catch (err) {
      if (token === updateToken) preferences.value = previous
      throw err
    }
  }

  return { preferences, loaded, load, update }
})
