export function normalizeAnswer(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function answersMatch(input: string, expected: string) {
  return normalizeAnswer(input) === normalizeAnswer(expected)
}

export function similarity(input: string, expected: string) {
  const a = normalizeAnswer(input)
  const b = normalizeAnswer(expected)

  if (!a || !b) return 0
  if (a === b) return 1

  const max = Math.max(a.length, b.length)
  const distance = levenshteinDistance(a, b)
  return Math.max(0, 1 - distance / max)
}

function levenshteinDistance(a: string, b: string) {
  const matrix = Array.from({ length: a.length + 1 }, (_, row) =>
    Array.from({ length: b.length + 1 }, (_, col) => (row === 0 ? col : col === 0 ? row : 0)),
  )

  for (let row = 1; row <= a.length; row += 1) {
    for (let col = 1; col <= b.length; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost,
      )
    }
  }

  return matrix[a.length][b.length]
}
