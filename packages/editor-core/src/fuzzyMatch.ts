export interface FileEntry {
  path: string
  title: string
}

/**
 * Scores `text` against `query`: an exact substring match always outranks a
 * subsequence match (order-preserving but non-contiguous), a match at the
 * very start of `text` scores a bit higher, and consecutive subsequence
 * characters score higher than scattered ones. Returns -1 if `query` isn't
 * a subsequence of `text` at all. Exported for reuse anywhere a single
 * label needs fuzzy-scoring against a query (e.g. the slash-command menu),
 * not just the file-shaped list this module was built for.
 */
export function scoreString(query: string, text: string): number {
  const q = query.toLowerCase()
  const t = text.toLowerCase()

  const substringIndex = t.indexOf(q)
  if (substringIndex !== -1) {
    const startBonus = substringIndex === 0 ? 100 : 0
    const exactBonus = t.length === q.length ? 500 : 0
    return 1000 + startBonus + exactBonus
  }

  let qi = 0
  let consecutiveBonus = 0
  let lastMatchIndex = -1
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (lastMatchIndex === ti - 1) consecutiveBonus += 2
      lastMatchIndex = ti
      qi++
    }
  }
  if (qi < q.length) return -1

  return 200 + consecutiveBonus
}

/**
 * Fuzzy-matches `query` against each file's title and path (title weighted
 * slightly higher), sorts descending by score, and - only as a tie-breaker
 * for equal scores - prefers the shorter path. An empty query short-circuits
 * to the first `limit` files as-is (used for the palette's empty-state list).
 */
export function fuzzyMatchFiles(query: string, files: FileEntry[], limit = 8): FileEntry[] {
  const trimmed = query.trim()
  if (!trimmed) return files.slice(0, limit)

  const scored = files
    .map((file) => {
      const titleScore = scoreString(trimmed, file.title)
      const pathScore = scoreString(trimmed, file.path)
      const score = Math.max(titleScore >= 0 ? titleScore + 50 : -1, pathScore)
      return { file, score }
    })
    .filter((entry) => entry.score >= 0)

  scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.file.path.length - b.file.path.length))

  return scored.slice(0, limit).map((entry) => entry.file)
}
