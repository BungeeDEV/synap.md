/** Shared by StatusBar.vue and NoteDetailsPopover.vue so word/char counting isn't reimplemented twice. */
export function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

export function countChars(text: string): number {
  return text.length
}
