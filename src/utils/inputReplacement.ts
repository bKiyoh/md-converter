import type { Nodes, Root } from 'mdast'
import { parseMarkdownAst } from '../parser/parseMarkdown'
import type {
  InputReplacementDraft,
  InputReplacementRule,
  InputReplacementValidationErrors,
} from '../types/inputReplacement'
import { countCharacters } from './countCharacters'

export const MAX_INPUT_REPLACEMENT_RULES = 100
export const MAX_INPUT_REPLACEMENT_SOURCE_LENGTH = 50
export const MAX_INPUT_REPLACEMENT_VALUE_LENGTH = 200

export const DUPLICATE_INPUT_REPLACEMENT_MESSAGE =
  '同じ入力文字がすでに登録されています。'
export const MARKDOWN_INPUT_REPLACEMENT_MESSAGE =
  'Markdown記法として使用される内容は登録できません。'
export const INPUT_REPLACEMENT_LIMIT_MESSAGE =
  '置換ルールは最大100件まで登録できます。'

const DIRECT_INPUT_BOUNDARIES = new Set([' ', '　', '\n'])
const MARKDOWN_SYMBOL_ONLY_PATTERN = /^(?:#{1,6}|\[\]|[-+*>_~`]+)$/

export type InputReplacementMatch = {
  rule: InputReplacementRule
  start: number
  end: number
}

export type InputReplacementEdit = {
  value: string
  selectionStart: number
  selectionEnd: number
}

function isPlainTextMarkdown(value: string): boolean {
  const tree = parseMarkdownAst(value)

  if (tree.children.length !== 1) {
    return false
  }

  const block = tree.children[0]
  return block?.type === 'paragraph' && block.children.every((node) => node.type === 'text')
}

export function containsMarkdownSyntax(value: string): boolean {
  const trimmedValue = value.trim()

  if (MARKDOWN_SYMBOL_ONLY_PATTERN.test(trimmedValue)) {
    return true
  }

  return !isPlainTextMarkdown(value)
}

export function validateInputReplacementDraft(
  draft: InputReplacementDraft,
  rules: readonly InputReplacementRule[],
  editingRuleId?: string,
): {
  source: string
  replacement: string
  errors: InputReplacementValidationErrors
} {
  const source = draft.source.trim()
  const replacement = draft.replacement
  const errors: InputReplacementValidationErrors = {}

  if (source.length === 0) {
    errors.source = '入力文字を入力してください。'
  } else if (countCharacters(source) > MAX_INPUT_REPLACEMENT_SOURCE_LENGTH) {
    errors.source = '入力文字は50文字以内で入力してください。'
  } else if (/[\r\n]/.test(source)) {
    errors.source = '入力文字に改行は使用できません。'
  } else if (containsMarkdownSyntax(source)) {
    errors.source = MARKDOWN_INPUT_REPLACEMENT_MESSAGE
  } else if (
    rules.some((rule) => rule.id !== editingRuleId && rule.source === source)
  ) {
    errors.source = DUPLICATE_INPUT_REPLACEMENT_MESSAGE
  }

  if (replacement.trim().length === 0) {
    errors.replacement = '置換後の文字を入力してください。'
  } else if (countCharacters(replacement) > MAX_INPUT_REPLACEMENT_VALUE_LENGTH) {
    errors.replacement = '置換後の文字は200文字以内で入力してください。'
  } else if (/[\r\n]/.test(replacement)) {
    errors.replacement = '置換後の文字に改行は使用できません。'
  } else if (containsMarkdownSyntax(replacement)) {
    errors.replacement = MARKDOWN_INPUT_REPLACEMENT_MESSAGE
  }

  return { source, replacement, errors }
}

function isDirectInputBoundary(value: string, index: number): boolean {
  return index === 0 || DIRECT_INPUT_BOUNDARIES.has(value[index - 1] ?? '')
}

export function findDirectInputReplacement(
  value: string,
  caret: number,
  rules: readonly InputReplacementRule[],
  delimiter?: string,
): InputReplacementMatch | null {
  const matches = rules
    .filter((rule) => rule.enabled && rule.source.length <= caret)
    .map((rule): InputReplacementMatch | null => {
      const start = caret - rule.source.length

      if (
        value.slice(start, caret) !== rule.source ||
        !isDirectInputBoundary(value, start)
      ) {
        return null
      }

      return { rule, start, end: caret }
    })
    .filter((match): match is InputReplacementMatch => match !== null)
    .sort((left, right) => right.rule.source.length - left.rule.source.length)

  const match = matches[0] ?? null
  if (
    match &&
    delimiter &&
    rules.some(
      (rule) =>
        rule.enabled &&
        rule.source.startsWith(match.rule.source + delimiter),
    )
  ) {
    return null
  }

  return match
}

export function findCompositionInputReplacement(
  value: string,
  start: number,
  end: number,
  rules: readonly InputReplacementRule[],
): InputReplacementMatch | null {
  const source = value.slice(start, end)
  const rule = rules.find((candidate) => candidate.enabled && candidate.source === source)
  return rule ? { rule, start, end } : null
}

export function applyInputReplacement(
  value: string,
  match: InputReplacementMatch,
): InputReplacementEdit {
  const nextCaret = match.start + match.rule.replacement.length

  return {
    value:
      value.slice(0, match.start) +
      match.rule.replacement +
      value.slice(match.end),
    selectionStart: nextCaret,
    selectionEnd: nextCaret,
  }
}

type NodeWithChildren = Nodes & {
  children?: Nodes[]
}

export type MarkdownCodeRange = {
  start: number
  end: number
}

function collectMarkdownCodeRanges(
  node: Root | Nodes,
  ranges: MarkdownCodeRange[],
): void {
  if (node.type === 'inlineCode' || node.type === 'code') {
    const start = node.position?.start.offset
    const end = node.position?.end.offset

    if (start !== undefined && end !== undefined) {
      ranges.push({ start, end })
    }
    return
  }

  const children = (node as NodeWithChildren).children
  children?.forEach((child) => collectMarkdownCodeRanges(child, ranges))
}

export function getMarkdownCodeRanges(markdown: string): MarkdownCodeRange[] {
  const ranges: MarkdownCodeRange[] = []
  collectMarkdownCodeRanges(parseMarkdownAst(markdown), ranges)
  return ranges
}

export function isInsideMarkdownCode(
  markdown: string,
  rangeStart: number,
  rangeEnd: number,
): boolean {
  return getMarkdownCodeRanges(markdown).some(
    (range) => rangeStart < range.end && rangeEnd > range.start,
  )
}
