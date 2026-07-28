export type TextMatch = {
  start: number
  end: number
}

export type ReplaceTextResult = {
  value: string
  count: number
}

function containsLineBreak(value: string): boolean {
  return value.includes('\n') || value.includes('\r')
}

function equalsIgnoringCase(left: string, rightLowerCase: string): boolean {
  return left.toLowerCase() === rightLowerCase
}

export function findTextMatches(value: string, query: string): TextMatch[] {
  if (query.length === 0 || containsLineBreak(query) || query.length > value.length) {
    return []
  }

  const matches: TextMatch[] = []
  const queryLowerCase = query.toLowerCase()
  let offset = 0

  while (offset <= value.length - query.length) {
    const candidate = value.slice(offset, offset + query.length)

    if (equalsIgnoringCase(candidate, queryLowerCase)) {
      matches.push({ start: offset, end: offset + query.length })
      offset += query.length
    } else {
      offset += 1
    }
  }

  return matches
}

export function findMatchIndexAtOrAfter(
  matches: readonly TextMatch[],
  offset: number,
): number {
  const index = matches.findIndex((match) => match.start >= offset)
  return index >= 0 ? index : matches.length > 0 ? 0 : -1
}

export function replaceTextMatch(
  value: string,
  match: TextMatch,
  replacement: string,
): ReplaceTextResult {
  if (
    match.start < 0 ||
    match.end < match.start ||
    match.end > value.length
  ) {
    return { value, count: 0 }
  }

  return {
    value: value.slice(0, match.start) + replacement + value.slice(match.end),
    count: 1,
  }
}

export function replaceAllTextMatches(
  value: string,
  query: string,
  replacement: string,
): ReplaceTextResult {
  const matches = findTextMatches(value, query)

  if (matches.length === 0) {
    return { value, count: 0 }
  }

  const parts: string[] = []
  let offset = 0

  for (const match of matches) {
    parts.push(value.slice(offset, match.start), replacement)
    offset = match.end
  }

  parts.push(value.slice(offset))
  return { value: parts.join(''), count: matches.length }
}
