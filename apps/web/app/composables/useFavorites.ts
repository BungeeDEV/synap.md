/**
 * Thin wrapper around the preferences store's `favorites` field - vault-relative
 * file paths, independent of folder location. Shared by the star toggle in
 * VaultTree.vue rows, the Favoriten section in VaultSidebar.vue, and
 * DocumentHeader.vue's title-row star, so all three read/write the same
 * synced-across-devices list instead of duplicating the toggle logic.
 */
export function useFavorites() {
  const preferences = usePreferencesStore()

  const favorites = computed(() => preferences.preferences.favorites)

  function isFavorite(path: string): boolean {
    return favorites.value.includes(path)
  }

  async function toggleFavorite(path: string): Promise<void> {
    const next = isFavorite(path)
      ? favorites.value.filter((favorite) => favorite !== path)
      : [...favorites.value, path]
    await preferences.update({ favorites: next })
  }

  return { favorites, isFavorite, toggleFavorite }
}
