import { VAULT_SORT_ORDER, type VaultSortMode } from '~/utils/sortVaultTree'

const STORAGE_KEY = 'synap:vaultSort'

/** UI-only preference (no server state) - persisted in localStorage, cycled through the four VAULT_SORT_ORDER modes. */
export function useVaultSort() {
  const mode = useState<VaultSortMode>('vaultSortMode', () => 'name-asc')

  onMounted(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored && (VAULT_SORT_ORDER as string[]).includes(stored)) mode.value = stored as VaultSortMode
  })

  function cycle(): void {
    const next = VAULT_SORT_ORDER[(VAULT_SORT_ORDER.indexOf(mode.value) + 1) % VAULT_SORT_ORDER.length]!
    mode.value = next
    window.localStorage.setItem(STORAGE_KEY, next)
  }

  return { mode, cycle }
}
