import { describe, expect, it } from 'vitest'
import { countCharacters } from '../../../src/utils/countCharacters'

describe('countCharacters', () => {
  it.each([
    ['', 0], ['**太字**', 6], ['# 日本語\n😀', 7], ['a\nb', 3],
    [' \t　', 3], ['e\u0301', 2], ['👨‍👩‍👧‍👦', 7],
    ['a\n', 2], ['a\r\nb', 4], ['**未完了[', 6],
  ])('原文 %j を %i コードポイントとして数える', (source, expected) => {
    expect(countCharacters(source)).toBe(expected)
  })

  it('サロゲートペアを1文字として数える', () => {
    expect(countCharacters('日本語😀')).toBe(4)
  })
})
