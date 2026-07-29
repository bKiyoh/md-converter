import type { TextEditResult } from './markdownEditor'
import {
  getMarkdownCodeRanges,
  type MarkdownCodeRange,
} from './inputReplacement'

const FULL_WIDTH_MARKERS: Readonly<Record<string, string>> = {
  '＃': '#',
  '＊': '*',
  '＿': '_',
  '～': '~',
  '－': '-',
  'ー': '-',
  '＋': '+',
  '＞': '>',
  '｀': '`',
  '［': '[',
  '］': ']',
  '（': '(',
  '）': ')',
  '｜': '|',
  '．': '.',
  '：': ':',
  'ｘ': 'x',
  'Ｘ': 'x',
}
const FULL_WIDTH_SYNTAX_MARKER_PATTERN = /[＃＊＿～－ー＋＞｀［］（）｜．：０-９]/
const IMMEDIATE_INPUT_MARKERS: Readonly<Record<string, string>> = {
  '＊': '*',
  '＿': '_',
  '～': '~',
  '｀': '`',
  '［': '[',
  '］': ']',
  '（': '(',
  '）': ')',
  '｜': '|',
}

type LineRange = {
  start: number
  end: number
  value: string
}

function toHalfWidthMarker(value: string): string {
  return FULL_WIDTH_MARKERS[value] ?? value
}

function toHalfWidthSpaces(value: string): string {
  return value.replaceAll('　', ' ')
}

function toHalfWidthDigits(value: string): string {
  return value.replace(/[０-９]/g, (digit) =>
    String.fromCharCode(digit.charCodeAt(0) - 0xfee0),
  )
}

function getCurrentLine(value: string, caret: number): LineRange {
  const safeCaret = Math.min(Math.max(caret, 0), value.length)
  const previousLineBreak = value.lastIndexOf('\n', Math.max(0, safeCaret - 1))
  const nextLineBreak = value.indexOf('\n', safeCaret)
  const start = previousLineBreak + 1
  const end = nextLineBreak === -1 ? value.length : nextLineBreak

  return {
    start,
    end,
    value: value.slice(start, end),
  }
}

function normalizeFence(line: string): string {
  return line.replace(
    /^( {0,3})(｀{3,}|～{3,})(.*)$/,
    (_match, indent: string, fence: string, suffix: string) =>
      indent + Array.from(fence, toHalfWidthMarker).join('') + suffix,
  )
}

function normalizeThematicBreak(line: string): string {
  const match = /^( {0,3})([－ー＊＿])((?:[ 　]*\2){2,}[ 　]*)$/.exec(line)
  if (!match) {
    return line
  }

  const marker = toHalfWidthMarker(match[2] ?? '')
  const remainder = toHalfWidthSpaces(match[3] ?? '').replaceAll(match[2] ?? '', marker)
  return (match[1] ?? '') + marker + remainder
}

function normalizeBlockPrefix(line: string): string {
  let normalized = line.replace(
    /^( *)([－ー＋＊])([ 　]+)(?:［|\[)([ 　xXｘＸ])(?:］|\])([ 　]+)/,
    (
      _match,
      indent: string,
      marker: string,
      markerSpacing: string,
      checkbox: string,
      checkboxSpacing: string,
    ) =>
      `${indent}${toHalfWidthMarker(marker)}${toHalfWidthSpaces(markerSpacing)}[${
        checkbox.trim().length === 0 ? ' ' : 'x'
      }]${toHalfWidthSpaces(checkboxSpacing)}`,
  )

  normalized = normalized.replace(
    /^( {0,3})(＃{1,6})$/,
    (_match, indent: string, markers: string) =>
      indent + Array.from(markers, toHalfWidthMarker).join(''),
  )

  normalized = normalized.replace(
    /^( {0,3})(＃{1,6})([ 　]+)/,
    (_match, indent: string, markers: string, spacing: string) =>
      indent +
      Array.from(markers, toHalfWidthMarker).join('') +
      toHalfWidthSpaces(spacing),
  )

  normalized = normalized.replace(
    /^( *)([０-９0-9]+)[．.]$/,
    (_match, indent: string, digits: string) =>
      `${indent}${toHalfWidthDigits(digits)}.`,
  )

  normalized = normalized.replace(
    /^( *)([０-９0-9]+)[．.]([ 　]+)/,
    (_match, indent: string, digits: string, spacing: string) =>
      `${indent}${toHalfWidthDigits(digits)}.${toHalfWidthSpaces(spacing)}`,
  )

  normalized = normalized.replace(
    /^( {0,3})(＞+)$/,
    (_match, indent: string, markers: string) =>
      indent + Array.from(markers, toHalfWidthMarker).join(''),
  )

  normalized = normalized.replace(
    /^( {0,3})(＞+)([ 　]+)/,
    (_match, indent: string, markers: string, spacing: string) =>
      indent +
      Array.from(markers, toHalfWidthMarker).join('') +
      toHalfWidthSpaces(spacing),
  )

  normalized = normalized.replace(
    /^( *)([－ー＋])$/,
    (_match, indent: string, marker: string) =>
      indent + toHalfWidthMarker(marker),
  )

  normalized = normalized.replace(
    /^( *)([－ー＋＊])([ 　]+)/,
    (_match, indent: string, marker: string, spacing: string) =>
      indent + toHalfWidthMarker(marker) + toHalfWidthSpaces(spacing),
  )

  return normalized
    .replace(
      /^( *)([-+*])([ 　]+)\[([ xXｘＸ])\]([ 　]+)/,
      (
        _match,
        indent: string,
        marker: string,
        markerSpacing: string,
        checkbox: string,
        checkboxSpacing: string,
      ) =>
        `${indent}${marker}${toHalfWidthSpaces(markerSpacing)}[${
          checkbox.trim().length === 0 ? ' ' : checkbox.toLowerCase().replace(/[ｘＸ]/, 'x')
        }]${toHalfWidthSpaces(checkboxSpacing)}`,
    )
    .replace(
      /^( {0,3})(#{1,6}|>+|[-+*]|\d+\.)([ 　]+)/,
      (_match, indent: string, marker: string, spacing: string) =>
        indent + marker + toHalfWidthSpaces(spacing),
    )
}

function isFullWidthTableRow(line: string): boolean {
  const trimmed = line.trim()
  return (
    (trimmed.startsWith('｜') || trimmed.startsWith('|')) &&
    (trimmed.endsWith('｜') || trimmed.endsWith('|')) &&
    Array.from(trimmed).filter(
      (character) => character === '｜' || character === '|',
    ).length >= 2
  )
}

function normalizeTable(line: string): string {
  if (!isFullWidthTableRow(line)) {
    return line
  }

  let normalized = line.replaceAll('｜', '|')
  const trimmed = normalized.trim()
  const cells = trimmed.slice(1, -1).split('|')
  const normalizedSeparators = cells.map((cell) =>
    toHalfWidthSpaces(cell)
      .replaceAll('－', '-')
      .replaceAll('ー', '-')
      .replaceAll('：', ':'),
  )
  const isSeparatorRow =
    normalizedSeparators.length > 0 &&
    normalizedSeparators.every((cell) => /^:?-{3,}:?$/.test(cell.trim()))

  if (isSeparatorRow) {
    normalized = normalized
      .replaceAll('－', '-')
      .replaceAll('ー', '-')
      .replaceAll('：', ':')
      .replaceAll('　', ' ')
  }

  return normalized
}

function normalizeInlineSyntax(line: string): string {
  return line
    .replace(
      /［([^［］\n]+)］（([^（）\n]*)）/g,
      (_match, label: string, destination: string) =>
        `[${label}](${destination})`,
    )
    .replace(
      /＊＊([^＊\n]+)＊＊/g,
      (_match, content: string) => `**${content}**`,
    )
    .replace(
      /＊([^＊\n]+)＊/g,
      (_match, content: string) => `*${content}*`,
    )
    .replace(
      /＿([^＿\n]+)＿/g,
      (_match, content: string) => `_${content}_`,
    )
    .replace(
      /～～([^～\n]+)～～/g,
      (_match, content: string) => `~~${content}~~`,
    )
    .replace(
      /(｀+)([^｀\n]+)\1/g,
      (_match, delimiter: string, content: string) =>
        `${'`'.repeat(delimiter.length)}${content}${'`'.repeat(delimiter.length)}`,
    )
}

function restoreProtectedCode(
  originalLine: string,
  normalizedLine: string,
  lineStart: number,
  codeRanges: readonly MarkdownCodeRange[],
): string {
  if (originalLine === normalizedLine) {
    return originalLine
  }

  let result = normalizedLine
  for (const range of codeRanges) {
    const start = Math.max(0, range.start - lineStart)
    const end = Math.min(originalLine.length, range.end - lineStart)

    if (start < end) {
      result =
        result.slice(0, start) +
        originalLine.slice(start, end) +
        result.slice(end)
    }
  }

  return result
}

function normalizeLine(
  line: LineRange,
  codeRanges: readonly MarkdownCodeRange[],
): string {
  const normalizedFence = normalizeFence(line.value)
  if (normalizedFence !== line.value) {
    return normalizedFence
  }

  const lineIsCode = codeRanges.some(
    (range) => line.start < range.end && line.end > range.start,
  )
  const lineIsEntireCodeBlock = codeRanges.some(
    (range) => range.start <= line.start && range.end >= line.end,
  )
  if (lineIsEntireCodeBlock) {
    return line.value
  }

  let normalized = normalizeThematicBreak(line.value)
  normalized = normalizeBlockPrefix(normalized)
  normalized = normalizeTable(normalized)
  normalized = normalizeInlineSyntax(normalized)

  return lineIsCode
    ? restoreProtectedCode(line.value, normalized, line.start, codeRanges)
    : normalized
}

export function normalizeFullWidthMarkdownInput(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): TextEditResult | null {
  if (selectionStart !== selectionEnd) {
    return null
  }

  const line = getCurrentLine(value, selectionEnd)
  if (
    !FULL_WIDTH_SYNTAX_MARKER_PATTERN.test(line.value) &&
    !line.value.includes('　')
  ) {
    return null
  }

  const normalizedLine = normalizeLine(line, getMarkdownCodeRanges(value))
  if (normalizedLine === line.value) {
    return null
  }

  return {
    value: value.slice(0, line.start) + normalizedLine + value.slice(line.end),
    selectionStart,
    selectionEnd,
  }
}

function rangeOverlapsCode(
  ranges: readonly MarkdownCodeRange[],
  start: number,
  end: number,
): boolean {
  return ranges.some((range) => start < range.end && end > range.start)
}

function isInsideInsertedRange(
  start: number,
  end: number,
  inputStart: number,
  inputEnd: number,
): boolean {
  return start >= inputStart && end <= inputEnd
}

function normalizeInsertedCodeDelimiters(
  value: string,
  inputStart: number,
  inputEnd: number,
): string {
  const normalizedFences = value.replace(
    /^( {0,3})(｀{3,}|～{3,})(.*)$/gm,
    (
      match: string,
      indent: string,
      fence: string,
      suffix: string,
      offset: number,
    ) => {
      const fenceStart = offset + indent.length
      const fenceEnd = fenceStart + fence.length
      if (!isInsideInsertedRange(fenceStart, fenceEnd, inputStart, inputEnd)) {
        return match
      }

      return indent + Array.from(fence, toHalfWidthMarker).join('') + suffix
    },
  )

  return normalizedFences.replace(
    /(｀+)([^｀\n]+)\1/g,
    (
      match: string,
      delimiter: string,
      content: string,
      offset: number,
    ) => {
      const closingStart = offset + delimiter.length + content.length
      if (
        !isInsideInsertedRange(
          offset,
          offset + delimiter.length,
          inputStart,
          inputEnd,
        ) ||
        !isInsideInsertedRange(
          closingStart,
          closingStart + delimiter.length,
          inputStart,
          inputEnd,
        )
      ) {
        return match
      }

      const halfWidthDelimiter = '`'.repeat(delimiter.length)
      return halfWidthDelimiter + content + halfWidthDelimiter
    },
  )
}

export function normalizeInsertedFullWidthMarkdown(
  value: string,
  inputStart: number,
  inputEnd: number,
  selectionStart: number,
  selectionEnd: number,
): TextEditResult | null {
  if (
    inputStart < 0 ||
    inputEnd <= inputStart ||
    inputEnd > value.length
  ) {
    return null
  }

  let normalizedValue = normalizeInsertedCodeDelimiters(
    value,
    inputStart,
    inputEnd,
  )
  const codeRanges = getMarkdownCodeRanges(normalizedValue)
  let changed = normalizedValue !== value

  for (let index = inputStart; index < inputEnd; index += 1) {
    if (rangeOverlapsCode(codeRanges, index, index + 1)) {
      continue
    }

    const character = normalizedValue[index] ?? ''
    const replacement = IMMEDIATE_INPUT_MARKERS[character]
    if (!replacement) {
      continue
    }

    normalizedValue =
      normalizedValue.slice(0, index) +
      replacement +
      normalizedValue.slice(index + 1)
    changed = true
  }

  const lineNormalized = normalizeFullWidthMarkdownInput(
    normalizedValue,
    selectionStart,
    selectionEnd,
  )
  if (lineNormalized) {
    return lineNormalized
  }

  return changed
    ? {
        value: normalizedValue,
        selectionStart,
        selectionEnd,
      }
    : null
}
