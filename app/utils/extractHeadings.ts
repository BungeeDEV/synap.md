export interface Heading {
  level: number
  text: string
  line: number
}

const FENCE_RE = /^```/
const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/

/** Line-based heading scan (no remark parse - cheap enough to run on every keystroke). Skips lines inside ``` fenced code blocks. */
export function extractHeadings(content: string): Heading[] {
  const headings: Heading[] = []
  let inFence = false

  content.split('\n').forEach((rawLine, index) => {
    if (FENCE_RE.test(rawLine.trim())) {
      inFence = !inFence
      return
    }
    if (inFence) return

    const match = HEADING_RE.exec(rawLine)
    if (match) {
      headings.push({ level: match[1]!.length, text: match[2]!, line: index + 1 })
    }
  })

  return headings
}
