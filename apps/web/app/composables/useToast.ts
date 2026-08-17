export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastEntry {
  id: number
  message: string
  variant: 'default' | 'error'
  action?: ToastAction
  count: number
}

const TOAST_DURATION_MS = 4000

let nextId = 0
// Per-toast dismiss timers, keyed by id - module-level (not inside
// useToast()) so a repeated show() from a fresh useToast() call can still
// find and reset the same duplicate toast's timer below.
const dismissTimers = new Map<number, ReturnType<typeof setTimeout>>()

/** Shared toast queue - same useState pattern as useCommandPalette/VaultTree's context menu. */
export function useToast() {
  const toasts = useState<ToastEntry[]>('toasts', () => [])

  function dismiss(id: number): void {
    const timer = dismissTimers.get(id)
    if (timer) clearTimeout(timer)
    dismissTimers.delete(id)
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  function scheduleDismiss(id: number): void {
    const existing = dismissTimers.get(id)
    if (existing) clearTimeout(existing)
    if (import.meta.client) {
      dismissTimers.set(id, setTimeout(() => dismiss(id), TOAST_DURATION_MS))
    }
  }

  // action is optional and additive - every existing toast.show(message) /
  // toast.show(message, 'error') call keeps working unchanged.
  function show(message: string, variant: ToastEntry['variant'] = 'default', action?: ToastAction): void {
    // Firing several identical toasts in quick succession (e.g. archiving
    // multiple notes back to back) merges them into one with a running
    // count instead of stacking separate entries. Toasts with an action are
    // never merged - the action callback is specific to whatever single
    // item triggered it, so merging would silently lose which item it
    // applies to.
    const duplicate = !action
      ? toasts.value.find((toast) => toast.message === message && toast.variant === variant && !toast.action)
      : undefined
    if (duplicate) {
      duplicate.count++
      scheduleDismiss(duplicate.id)
      return
    }

    const id = nextId++
    toasts.value = [...toasts.value, { id, message, variant, action, count: 1 }]
    scheduleDismiss(id)
  }

  return { toasts, show, dismiss }
}
