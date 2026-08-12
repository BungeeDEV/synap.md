/** Thin wrapper around the preferences store's `folderColors` field - same shape as useFavorites.ts. */
export function useFolderColors() {
  const preferences = usePreferencesStore()

  const folderColors = computed(() => preferences.preferences.folderColors)

  function colorKeyOf(path: string): string | undefined {
    return folderColors.value[path]
  }

  async function setFolderColor(path: string, key: string | null): Promise<void> {
    const current = folderColors.value
    const next = key
      ? { ...current, [path]: key }
      : Object.fromEntries(Object.entries(current).filter(([entryPath]) => entryPath !== path))
    await preferences.update({ folderColors: next })
  }

  return { folderColors, colorKeyOf, setFolderColor }
}
