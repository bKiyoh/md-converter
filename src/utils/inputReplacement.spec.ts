import { describe, expect, it } from 'vitest'
import type { InputReplacementRule } from '../types/inputReplacement'
import {
  applyInputReplacement,
  containsMarkdownSyntax,
  findCompositionInputReplacement,
  findDirectInputReplacement,
  isInsideMarkdownCode,
  validateInputReplacementDraft,
} from './inputReplacement'

const rules: InputReplacementRule[] = [
  { id: 'right', source: '右', replacement: '⇨', enabled: true },
  { id: 'ai', source: 'ai', replacement: 'AI', enabled: true },
  { id: 'phrase', source: 'hello world', replacement: '挨拶', enabled: true },
  { id: 'disabled', source: 'off', replacement: 'ON', enabled: false },
]

describe('inputReplacement', () => {
  it('区切り直前の完全一致だけを検出する', () => {
    expect(findDirectInputReplacement('右', 1, rules)?.rule.id).toBe('right')
    expect(findDirectInputReplacement('右側', 2, rules)).toBeNull()
    expect(findDirectInputReplacement('左右', 2, rules)).toBeNull()
    expect(findDirectInputReplacement('ai', 2, rules)?.rule.id).toBe('ai')
    expect(findDirectInputReplacement('off', 3, rules)).toBeNull()
  })

  it('内部空白を含む最長のルールを優先する', () => {
    const overlappingRules: InputReplacementRule[] = [
      ...rules,
      { id: 'world', source: 'world', replacement: '世界', enabled: true },
    ]

    expect(
      findDirectInputReplacement('hello world', 11, overlappingRules)?.rule.id,
    ).toBe('phrase')
  })

  it('IMEでは確定範囲全体だけを照合する', () => {
    expect(findCompositionInputReplacement('あい右', 2, 3, rules)?.rule.id).toBe(
      'right',
    )
    expect(findCompositionInputReplacement('左右', 0, 2, rules)).toBeNull()
  })

  it('一致範囲を置換し、置換後の末尾へカーソルを移動する', () => {
    const match = findDirectInputReplacement('- 右', 3, rules)
    expect(match).not.toBeNull()
    expect(applyInputReplacement('- 右', match!)).toEqual({
      value: '- ⇨',
      selectionStart: 3,
      selectionEnd: 3,
    })
  })

  it('インラインコードとコードブロックを保護する', () => {
    expect(isInsideMarkdownCode('`右`', 1, 2)).toBe(true)
    expect(isInsideMarkdownCode('```\n右\n```', 4, 5)).toBe(true)
    expect(isInsideMarkdownCode('    右', 4, 5)).toBe(true)
    expect(isInsideMarkdownCode('- 右', 2, 3)).toBe(false)
  })

  it.each(['# 見出し', '**太字**', '- 項目', '> 引用', '`code`', '![画像](url)'])(
    'Markdown記法 %s を検出する',
    (value) => {
      expect(containsMarkdownSyntax(value)).toBe(true)
    },
  )

  it.each(['**', '_', '__', '`', '[]'])(
    '不完全なMarkdown記号 %s も検出する',
    (value) => {
      expect(containsMarkdownSyntax(value)).toBe(true)
    },
  )

  it.each(['C#', 'issue#123', 'AI', '⇨'])(
    '通常の文字列 %s は許可する',
    (value) => {
      expect(containsMarkdownSyntax(value)).toBe(false)
    },
  )

  it('前後空白を除去し、重複と文字数と改行を検証する', () => {
    expect(
      validateInputReplacementDraft(
        { source: '  ai  ', replacement: '人工知能' },
        rules,
      ),
    ).toMatchObject({
      source: 'ai',
      errors: { source: '同じ入力文字がすでに登録されています。' },
    })

    expect(
      validateInputReplacementDraft(
        { source: 'a'.repeat(51), replacement: 'x\nx' },
        [],
      ).errors,
    ).toEqual({
      source: '入力文字は50文字以内で入力してください。',
      replacement: '置換後の文字に改行は使用できません。',
    })
  })
})
