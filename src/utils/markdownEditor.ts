export type TextEditResult = {
  value: string
  selectionStart: number
  selectionEnd: number
}

export type MarkdownShortcut =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'inline-code'
  | 'link'
  | 'bullet-list'
  | 'ordered-list'
  | 'quote'
  | 'heading-1'

type ShortcutKeyEvent = Pick<
  KeyboardEvent,
  'altKey' | 'ctrlKey' | 'isComposing' | 'key' | 'metaKey' | 'shiftKey'
> & { code?: string }

type ListLine = {
  indent: string
  marker: string
  orderedNumber: number | null
  content: string
}

type LineParts = {
  indent: string
  content: string
}

type LineToggle = {
  isApplied: (line: LineParts) => boolean
  apply: (line: LineParts, nonEmptyLineIndex: number) => string
  remove: (line: LineParts) => string
}

const LIST_LINE_PATTERN = /^( *)([-*+]|(\d+)\.)([ \t]+)(.*)$/
const FENCE_PATTERN = /^ {0,3}(`{3,}|~{3,})/
const BULLET_PREFIX_PATTERN = /^[-*+]\s+/
const ORDERED_PREFIX_PATTERN = /^\d+\.\s+/
const INDENT = '  '

export function getMarkdownShortcut(event: ShortcutKeyEvent): MarkdownShortcut | null {
  if (event.isComposing || (!event.ctrlKey && !event.metaKey)) {
    return null
  }

  const code = event.code || `Key${event.key.toUpperCase()}`
  if (!event.altKey && !event.shiftKey) {
    switch (code) {
      case 'KeyB':
        return 'bold'
      case 'KeyI':
        return 'italic'
      case 'KeyE':
        return 'inline-code'
      case 'KeyK':
        return 'link'
    }
  }

  if (!event.altKey && event.shiftKey) {
    switch (code) {
      case 'KeyX':
        return 'strikethrough'
      case 'Digit7':
        return 'ordered-list'
      case 'Digit8':
        return 'bullet-list'
      case 'Digit9':
        return 'quote'
    }
  }

  if (event.altKey && !event.shiftKey && code === 'Digit1') {
    return 'heading-1'
  }

  return null
}

function hasItalicWrapper(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): boolean {
  return (
    value.slice(selectionStart - 1, selectionStart) === '*' &&
    value.slice(selectionEnd, selectionEnd + 1) === '*' &&
    value.slice(selectionStart - 2, selectionStart - 1) !== '*' &&
    value.slice(selectionEnd + 1, selectionEnd + 2) !== '*'
  )
}

function isExactSelectedWrapper(selectedText: string, prefix: string, suffix: string): boolean {
  if (!selectedText.startsWith(prefix) || !selectedText.endsWith(suffix)) {
    return false
  }

  if (
    prefix === '*' &&
    (selectedText.startsWith('**') || selectedText.endsWith('**'))
  ) {
    return false
  }

  return selectedText.length >= prefix.length + suffix.length
}

export function wrapSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  options: { prefix: string; suffix: string },
): TextEditResult {
  const { prefix, suffix } = options
  const selectedText = value.slice(selectionStart, selectionEnd)

  if (isExactSelectedWrapper(selectedText, prefix, suffix)) {
    const unwrappedText = selectedText.slice(prefix.length, -suffix.length)
    return {
      value: value.slice(0, selectionStart) + unwrappedText + value.slice(selectionEnd),
      selectionStart,
      selectionEnd: selectionStart + unwrappedText.length,
    }
  }

  const hasOuterWrapper =
    prefix === '*' && suffix === '*'
      ? hasItalicWrapper(value, selectionStart, selectionEnd)
      : value.slice(selectionStart - prefix.length, selectionStart) === prefix &&
        value.slice(selectionEnd, selectionEnd + suffix.length) === suffix

  if (selectionStart !== selectionEnd && hasOuterWrapper) {
    return {
      value:
        value.slice(0, selectionStart - prefix.length) +
        selectedText +
        value.slice(selectionEnd + suffix.length),
      selectionStart: selectionStart - prefix.length,
      selectionEnd: selectionEnd - prefix.length,
    }
  }

  if (selectionStart === selectionEnd) {
    return {
      value: value.slice(0, selectionStart) + prefix + suffix + value.slice(selectionEnd),
      selectionStart: selectionStart + prefix.length,
      selectionEnd: selectionStart + prefix.length,
    }
  }

  return {
    value:
      value.slice(0, selectionStart) + prefix + selectedText + suffix + value.slice(selectionEnd),
    selectionStart: selectionStart + prefix.length,
    selectionEnd: selectionEnd + prefix.length,
  }
}

function getLongestBacktickRun(value: string): number {
  return Math.max(0, ...Array.from(value.matchAll(/`+/g), (match) => match[0].length))
}

function unwrapSelectedInlineCode(selectedText: string): string | null {
  const opening = /^(`+)/.exec(selectedText)?.[1]
  if (!opening || !selectedText.endsWith(opening)) {
    return null
  }

  let content = selectedText.slice(opening.length, -opening.length)
  if (content.startsWith(' ') && content.endsWith(' ') && content.trim().length > 0) {
    content = content.slice(1, -1)
  }
  return content
}

function toggleInlineCode(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): TextEditResult {
  const selectedText = value.slice(selectionStart, selectionEnd)
  const unwrappedText = unwrapSelectedInlineCode(selectedText)

  if (unwrappedText !== null) {
    return {
      value: value.slice(0, selectionStart) + unwrappedText + value.slice(selectionEnd),
      selectionStart,
      selectionEnd: selectionStart + unwrappedText.length,
    }
  }

  const leftMatch = /(`+)( ?)$/.exec(value.slice(0, selectionStart))
  const rightMatch = /^( ?)(`+)/.exec(value.slice(selectionEnd))
  if (
    selectionStart !== selectionEnd &&
    leftMatch &&
    rightMatch &&
    leftMatch[1] === rightMatch[2]
  ) {
    const leftLength = leftMatch[0].length
    const rightLength = rightMatch[0].length
    return {
      value:
        value.slice(0, selectionStart - leftLength) +
        selectedText +
        value.slice(selectionEnd + rightLength),
      selectionStart: selectionStart - leftLength,
      selectionEnd: selectionEnd - leftLength,
    }
  }

  const delimiter = '`'.repeat(getLongestBacktickRun(selectedText) + 1)
  const needsPadding = selectedText.startsWith('`') || selectedText.endsWith('`')
  const padding = needsPadding ? ' ' : ''
  const replacement = `${delimiter}${padding}${selectedText}${padding}${delimiter}`

  if (selectionStart === selectionEnd) {
    return {
      value: value.slice(0, selectionStart) + replacement + value.slice(selectionEnd),
      selectionStart: selectionStart + delimiter.length + padding.length,
      selectionEnd: selectionStart + delimiter.length + padding.length,
    }
  }

  const contentStart = selectionStart + delimiter.length + padding.length
  return {
    value: value.slice(0, selectionStart) + replacement + value.slice(selectionEnd),
    selectionStart: contentStart,
    selectionEnd: contentStart + selectedText.length,
  }
}

function toggleLink(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): TextEditResult {
  const selectedText = value.slice(selectionStart, selectionEnd)
  const selectedLink = /^\[([^\]\n]*)\]\(([^)\n]*)\)$/.exec(selectedText)

  if (selectedLink) {
    const linkText = selectedLink[1] ?? ''
    return {
      value: value.slice(0, selectionStart) + linkText + value.slice(selectionEnd),
      selectionStart,
      selectionEnd: selectionStart + linkText.length,
    }
  }

  const linkSuffix = /^\]\([^)\n]*\)/.exec(value.slice(selectionEnd))?.[0]
  if (
    selectionStart !== selectionEnd &&
    value.slice(selectionStart - 1, selectionStart) === '[' &&
    linkSuffix
  ) {
    return {
      value:
        value.slice(0, selectionStart - 1) +
        selectedText +
        value.slice(selectionEnd + linkSuffix.length),
      selectionStart: selectionStart - 1,
      selectionEnd: selectionEnd - 1,
    }
  }

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

function getLineStart(value: string, position: number): number {
  return value.lastIndexOf('\n', Math.max(0, position - 1)) + 1
}

function getLineEnd(value: string, position: number): number {
  const lineEnd = value.indexOf('\n', position)
  return lineEnd === -1 ? value.length : lineEnd
}

function getSelectedLineRange(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): { rangeStart: number; rangeEnd: number } {
  const rangeStart = getLineStart(value, selectionStart)
  const effectiveEnd =
    selectionEnd > selectionStart && value[selectionEnd - 1] === '\n'
      ? selectionEnd - 1
      : selectionEnd
  return { rangeStart, rangeEnd: getLineEnd(value, effectiveEnd) }
}

function splitLine(line: string): LineParts {
  const indent = /^[ \t]*/.exec(line)?.[0] ?? ''
  return { indent, content: line.slice(indent.length) }
}

function toggleSelectedLines(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  toggle: LineToggle,
): TextEditResult | null {
  const { rangeStart, rangeEnd } = getSelectedLineRange(value, selectionStart, selectionEnd)
  const lines = value.slice(rangeStart, rangeEnd).split('\n').map(splitLine)
  const nonEmptyLines = lines.filter((line) => line.content.length > 0)
  if (nonEmptyLines.length === 0) {
    return null
  }

  const shouldRemove = nonEmptyLines.every(toggle.isApplied)
  let nonEmptyLineIndex = 0
  const changedLines = lines.map((line) => {
    if (line.content.length === 0) {
      return line.indent
    }

    const changedLine = shouldRemove
      ? toggle.remove(line)
      : toggle.apply(line, nonEmptyLineIndex)
    nonEmptyLineIndex += 1
    return changedLine
  })
  const replacement = changedLines.join('\n')

  return {
    value: value.slice(0, rangeStart) + replacement + value.slice(rangeEnd),
    selectionStart: rangeStart,
    selectionEnd: rangeStart + replacement.length,
  }
}

function stripListPrefix(content: string): string {
  return content.replace(BULLET_PREFIX_PATTERN, '').replace(ORDERED_PREFIX_PATTERN, '')
}

function toggleBulletList(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): TextEditResult | null {
  return toggleSelectedLines(value, selectionStart, selectionEnd, {
    isApplied: (line) => BULLET_PREFIX_PATTERN.test(line.content),
    apply: (line) => `${line.indent}- ${stripListPrefix(line.content)}`,
    remove: (line) => `${line.indent}${line.content.replace(BULLET_PREFIX_PATTERN, '')}`,
  })
}

function toggleOrderedList(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): TextEditResult | null {
  return toggleSelectedLines(value, selectionStart, selectionEnd, {
    isApplied: (line) => ORDERED_PREFIX_PATTERN.test(line.content),
    apply: (line, index) => `${line.indent}${index + 1}. ${stripListPrefix(line.content)}`,
    remove: (line) => `${line.indent}${line.content.replace(ORDERED_PREFIX_PATTERN, '')}`,
  })
}

function toggleFixedLinePrefix(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string,
): TextEditResult | null {
  return toggleSelectedLines(value, selectionStart, selectionEnd, {
    isApplied: (line) => line.content.startsWith(prefix),
    apply: (line) =>
      line.content.startsWith(prefix)
        ? `${line.indent}${line.content}`
        : `${line.indent}${prefix}${line.content}`,
    remove: (line) => `${line.indent}${line.content.slice(prefix.length)}`,
  })
}

export function applyMarkdownShortcut(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  shortcut: MarkdownShortcut,
): TextEditResult | null {
  switch (shortcut) {
    case 'bold':
      return wrapSelection(value, selectionStart, selectionEnd, {
        prefix: '**',
        suffix: '**',
      })
    case 'italic':
      return wrapSelection(value, selectionStart, selectionEnd, { prefix: '*', suffix: '*' })
    case 'strikethrough':
      return wrapSelection(value, selectionStart, selectionEnd, { prefix: '~~', suffix: '~~' })
    case 'inline-code':
      return toggleInlineCode(value, selectionStart, selectionEnd)
    case 'link':
      return toggleLink(value, selectionStart, selectionEnd)
    case 'bullet-list':
      return toggleBulletList(value, selectionStart, selectionEnd)
    case 'ordered-list':
      return toggleOrderedList(value, selectionStart, selectionEnd)
    case 'quote':
      return toggleFixedLinePrefix(value, selectionStart, selectionEnd, '> ')
    case 'heading-1':
      return toggleFixedLinePrefix(value, selectionStart, selectionEnd, '# ')
  }
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
  if (isInsideFencedCode(value, lineStart)) {
    return null
  }

  const line = value.slice(lineStart, lineEnd)
  const listLine = parseListLine(line)
  if (!listLine) {
    return null
  }

  const contentStart = lineEnd - listLine.content.length
  if (selectionStart < contentStart) {
    return null
  }

  const nextMarker =
    listLine.orderedNumber === null ? listLine.marker : `${listLine.orderedNumber + 1}.`

  if (selectionStart < lineEnd) {
    const insertion = `\n${listLine.indent}${nextMarker} `
    return {
      value: value.slice(0, selectionStart) + insertion + value.slice(selectionStart),
      selectionStart: selectionStart + insertion.length,
      selectionEnd: selectionStart + insertion.length,
    }
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
  const { rangeStart, rangeEnd } = getSelectedLineRange(value, selectionStart, selectionEnd)

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
