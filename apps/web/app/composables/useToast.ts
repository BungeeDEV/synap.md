export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastEntry {
  id: number
  message: string
  variant: 'default' | 'error'
  action?: ToastAction
}

const TOAST_DURATION_MS = 4000

let nextId = 0

/** Shared toast queue - same useState pattern as useCommandPalette/VaultTree's context menu. */
export function useToast() {
  const toasts = useState<ToastEntry[]>('toasts', () => [])

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  // action is optional and additive - every existing toast.show(message) /
  // toast.show(message, 'error') call keeps working unchanged.
  function show(message: string, variant: ToastEntry['variant'] = 'default', action?: ToastAction): void {
    const id = nextId++
    toasts.value = [...toasts.value, { id, message, variant, action }]
    if (import.meta.client) {
      setTimeout(() => dismiss(id), TOAST_DURATION_MS)
    }
  }

  return { toasts, show, dismiss }
}
