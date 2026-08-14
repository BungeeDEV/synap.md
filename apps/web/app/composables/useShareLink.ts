export const useShareLink = () => {
  const isOpen = useState('share-link-dialog-open', () => false)
  const targetPath = useState('share-link-dialog-path', () => '')

  function openShareDialog(path: string): void {
    targetPath.value = path
    isOpen.value = true
  }

  function closeShareDialog(): void {
    isOpen.value = false
    targetPath.value = ''
  }

  return {
    isOpen,
    targetPath,
    openShareDialog,
    closeShareDialog
  }
}
