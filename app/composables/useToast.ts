export interface ToastEntry {
  id: number
  message: string
  variant: 'default' | 'error'
}

const TOAST_DURATION_MS = 4000

let nextId = 0

/** Shared toast queue - same useState pattern as useCommandPalette/VaultTree's context menu. */
export function useToast() {
  const toasts = useState<ToastEntry[]>('toasts', () => [])

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  function show(message: string, variant: ToastEntry['variant'] = 'default'): void {
    const id = nextId++
    toasts.value = [...toasts.value, { id, message, variant }]
    if (import.meta.client) {
      setTimeout(() => dismiss(id), TOAST_DURATION_MS)
    }
  }

  return { toasts, show, dismiss }
}
