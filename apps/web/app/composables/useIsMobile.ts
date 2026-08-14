const MOBILE_BREAKPOINT_QUERY = '(max-width: 767px)'

/** Reactive match for Tailwind's `md` breakpoint (768px) - the same cutoff the responsive classes use, so JS-driven fallbacks (split-view auto-downgrade) stay in sync with the CSS. */
export function useIsMobile() {
  const isMobile = useState<boolean>('isMobileViewport', () => false)

  if (import.meta.client) {
    const mql = window.matchMedia(MOBILE_BREAKPOINT_QUERY)
    isMobile.value = mql.matches

    const handler = (event: MediaQueryListEvent): void => {
      isMobile.value = event.matches
    }

    onMounted(() => {
      isMobile.value = mql.matches
      mql.addEventListener('change', handler)
    })
    onBeforeUnmount(() => mql.removeEventListener('change', handler))
  }

  return { isMobile }
}
