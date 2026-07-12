export type TextEditResult = {
  value: string
  selectionStart: number
  selectionEnd: number
}

export type MarkdownShortcut = 'bold' | 'italic' | 'link'

type ShortcutKeyEvent = Pick<
  KeyboardEvent,
  'altKey' | 'ctrlKey' | 'isComposing' | 'key' | 'metaKey' | 'shiftKey'
>

type ListLine = {
  indent: string
  marker: string
  orderedNumber: number | null
  content: string
}

const LIST_LINE_PATTERN = /^( *)([-*+]|(\d+)\.)([ \t]+)(.*)$/
const FENCE_PATTERN = /^ {0,3}(`{3,}|~{3,})/
const INDENT = '  '

export function getMarkdownShortcut(event: ShortcutKeyEvent): MarkdownShortcut | null {
  if (
    event.isComposing ||
    event.altKey ||
    event.shiftKey ||
    (!event.ctrlKey && !event.metaKey)
  ) {
    return null
  }

  switch (event.key.toLowerCase()) {
    case 'b':
      return 'bold'
    case 'i':
      return 'italic'
    case 'k':
      return 'link'
    default:
      return null
  }
}

function isItalicWrapper(value: string, selectionStart: number, selectionEnd: number): boolean {
  return (
    value.slice(selectionStart - 1, selectionStart) === '*' &&
    value.slice(selectionEnd, selectionEnd + 1) === '*' &&
    value.slice(selectionStart - 2, selectionStart - 1) !== '*' &&
    value.slice(selectionEnd + 1, selectionEnd + 2) !== '*'
  )
}

function toggleMarker(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  marker: '*' | '**',
): TextEditResult {
  const selectedText = value.slice(selectionStart, selectionEnd)
  const markerLength = marker.length

  if (
    selectedText.length >= markerLength * 2 &&
    selectedText.startsWith(marker) &&
    selectedText.endsWith(marker)
  ) {
    const unwrappedText = selectedText.slice(markerLength, -markerLength)
    return {
      value: value.slice(0, selectionStart) + unwrappedText + value.slice(selectionEnd),
      selectionStart,
      selectionEnd: selectionStart + unwrappedText.length,
    }
  }

  const hasOuterWrapper =
    marker === '*'
      ? isItalicWrapper(value, selectionStart, selectionEnd)
      : value.slice(selectionStart - markerLength, selectionStart) === marker &&
        value.slice(selectionEnd, selectionEnd + markerLength) === marker

  if (selectionStart !== selectionEnd && hasOuterWrapper) {
    return {
      value:
        value.slice(0, selectionStart - markerLength) +
        selectedText +
        value.slice(selectionEnd + markerLength),
      selectionStart: selectionStart - markerLength,
      selectionEnd: selectionEnd - markerLength,
    }
  }

  if (selectionStart === selectionEnd) {
    return {
      value: value.slice(0, selectionStart) + marker + marker + value.slice(selectionEnd),
      selectionStart: selectionStart + markerLength,
      selectionEnd: selectionStart + markerLength,
    }
  }

  return {
    value:
      value.slice(0, selectionStart) + marker + selectedText + marker + value.slice(selectionEnd),
    selectionStart: selectionStart + markerLength,
    selectionEnd: selectionEnd + markerLength,
  }
}

function insertLink(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): TextEditResult {
  const selectedText = value.slice(selectionStart, selectionEnd)
  const replacement = `[${selectedText}](URL)`

  if (selectionStart === selectionEnd) {
    return {
      value: value.slice(0, selectionStart) + replacement + value.slice(selectionEnd),
      selectionStart: selectionStart + 1,
      selectionEnd: selectionStart + 1,
    }
  }

  const urlStart = selectionStart + selectedText.length + 3
  return {
    value: value.slice(0, selectionStart) + replacement + value.slice(selectionEnd),
    selectionStart: urlStart,
    selectionEnd: urlStart + 3,
  }
}

export function applyMarkdownShortcut(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  shortcut: MarkdownShortcut,
): TextEditResult {
  switch (shortcut) {
    case 'bold':
      return toggleMarker(value, selectionStart, selectionEnd, '**')
    case 'italic':
      return toggleMarker(value, selectionStart, selectionEnd, '*')
    case 'link':
      return insertLink(value, selectionStart, selectionEnd)
  }
}

function getLineStart(value: string, position: number): number {
  return value.lastIndexOf('\n', Math.max(0, position - 1)) + 1
}

function getLineEnd(value: string, position: number): number {
  const lineEnd = value.indexOf('\n', position)
  return lineEnd === -1 ? value.length : lineEnd
}

function parseListLine(line: string): ListLine | null {
  const match = LIST_LINE_PATTERN.exec(line)
  if (!match) {
    return null
  }

  return {
    indent: match[1] ?? '',
    marker: match[2] ?? '',
    orderedNumber: match[3] === undefined ? null : Number(match[3]),
    content: match[5] ?? '',
  }
}

function isInsideFencedCode(value: string, lineStart: number): boolean {
  const precedingLines = value.slice(0, lineStart).split('\n')
  let activeFence: { character: string; length: number } | null = null

  for (const line of precedingLines) {
    const match = FENCE_PATTERN.exec(line)
    if (!match?.[1]) {
      continue
    }

    const fence = match[1]
    if (!activeFence) {
      activeFence = { character: fence[0] ?? '', length: fence.length }
    } else if (
      fence[0] === activeFence.character &&
      fence.length >= activeFence.length &&
      line.trim().replace(fence, '').trim() === ''
    ) {
      activeFence = null
    }
  }

  return activeFence !== null
}

export function continueMarkdownList(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): TextEditResult | null {
  if (selectionStart !== selectionEnd) {
    return null
  }

  const lineStart = getLineStart(value, selectionStart)
  const lineEnd = getLineEnd(value, selectionStart)
  if (selectionStart !== lineEnd || isInsideFencedCode(value, lineStart)) {
    return null
  }

  const listLine = parseListLine(value.slice(lineStart, lineEnd))
  if (!listLine) {
    return null
  }

  if (listLine.content.trim().length === 0) {
    if (listLine.indent.length < INDENT.length) {
      return {
        value: value.slice(0, lineStart) + '\n' + value.slice(lineEnd),
        selectionStart: lineStart + 1,
        selectionEnd: lineStart + 1,
      }
    }

    const replacement = `${listLine.indent.slice(INDENT.length)}${listLine.marker} `
    return {
      value: value.slice(0, lineStart) + replacement + value.slice(lineEnd),
      selectionStart: lineStart + replacement.length,
      selectionEnd: lineStart + replacement.length,
    }
  }

  const nextMarker =
    listLine.orderedNumber === null ? listLine.marker : `${listLine.orderedNumber + 1}.`
  const insertion = `\n${listLine.indent}${nextMarker} `
  return {
    value: value.slice(0, selectionStart) + insertion + value.slice(selectionEnd),
    selectionStart: selectionStart + insertion.length,
    selectionEnd: selectionStart + insertion.length,
  }
}

function removeOneIndent(line: string): { line: string; removed: number } {
  const removableIndent = /^ {1,2}/.exec(line)?.[0].length ?? 0
  return { line: line.slice(removableIndent), removed: removableIndent }
}

export function changeMarkdownListIndent(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  direction: 'indent' | 'outdent',
): TextEditResult | null {
  const isMultiline = value.slice(selectionStart, selectionEnd).includes('\n')
  const rangeStart = getLineStart(value, selectionStart)
  const effectiveEnd =
    isMultiline && selectionEnd > selectionStart && value[selectionEnd - 1] === '\n'
      ? selectionEnd - 1
      : selectionEnd
  const rangeEnd = getLineEnd(value, effectiveEnd)

  if (isInsideFencedCode(value, rangeStart)) {
    return null
  }

  const selectedLines = value.slice(rangeStart, rangeEnd).split('\n')
  if (
    selectedLines.some((_, index) => {
      const currentStart =
        rangeStart + selectedLines.slice(0, index).reduce((sum, line) => sum + line.length + 1, 0)
      return isInsideFencedCode(value, currentStart)
    })
  ) {
    return null
  }

  if (!isMultiline && !parseListLine(selectedLines[0] ?? '')) {
    return null
  }

  const changedLines = selectedLines.map((line) =>
    direction === 'indent' ? `${INDENT}${line}` : removeOneIndent(line).line,
  )
  const replacement = changedLines.join('\n')
  const nextValue = value.slice(0, rangeStart) + replacement + value.slice(rangeEnd)

  if (isMultiline) {
    return {
      value: nextValue,
      selectionStart: rangeStart,
      selectionEnd: rangeStart + replacement.length,
    }
  }

  const delta = replacement.length - (rangeEnd - rangeStart)
  return {
    value: nextValue,
    selectionStart: Math.max(rangeStart, selectionStart + delta),
    selectionEnd: Math.max(rangeStart, selectionEnd + delta),
  }
}
