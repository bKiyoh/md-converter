import { describe, expect, it } from 'vitest'
import { countCharacters } from '../../../src/utils/countCharacters'

describe('countCharacters', () => {
  it('サロゲートペアを1文字として数える', () => {
    expect(countCharacters('日本語😀')).toBe(4)
  })
})
