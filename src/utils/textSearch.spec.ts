import { describe, expect, it } from 'vitest'
import {
  findMatchIndexAtOrAfter,
  findTextMatches,
  replaceAllTextMatches,
  replaceTextMatch,
} from './textSearch'

describe('findTextMatches', () => {
  it('一致する文字列を先頭から重複なしで検索する', () => {
    expect(findTextMatches('test test testing', 'test')).toEqual([
      { start: 0, end: 4 },
      { start: 5, end: 9 },
      { start: 10, end: 14 },
    ])
  })

  it('大文字と小文字を区別しない', () => {
    expect(findTextMatches('Markdown markdown MARKDOWN', 'markDOWN')).toEqual([
      { start: 0, end: 8 },
      { start: 9, end: 17 },
      { start: 18, end: 26 },
    ])
  })

  it('一致なしと空の検索文字列を結果なしとして扱う', () => {
    expect(findTextMatches('本文', 'なし')).toEqual([])
    expect(findTextMatches('本文', '')).toEqual([])
  })

  it('正規表現の特殊文字を通常文字として検索する', () => {
    expect(findTextMatches('.* [test] .*', '.*')).toEqual([
      { start: 0, end: 2 },
      { start: 10, end: 12 },
    ])
    expect(findTextMatches('a+b aab', 'a+b')).toEqual([{ start: 0, end: 3 }])
  })

  it('改行を含む検索文字列では検索しない', () => {
    expect(findTextMatches('前\n後', '前\n後')).toEqual([])
  })
})

describe('findMatchIndexAtOrAfter', () => {
  const matches = [
    { start: 1, end: 2 },
    { start: 5, end: 6 },
  ]

  it('指定位置以降の一致を選び、末尾を越えた場合は先頭へ戻る', () => {
    expect(findMatchIndexAtOrAfter(matches, 2)).toBe(1)
    expect(findMatchIndexAtOrAfter(matches, 6)).toBe(0)
    expect(findMatchIndexAtOrAfter([], 0)).toBe(-1)
  })
})

describe('text replacement', () => {
  it('指定した一致だけを置換する', () => {
    expect(
      replaceTextMatch('one two one', { start: 8, end: 11 }, 'three'),
    ).toEqual({ value: 'one two three', count: 1 })
  })

  it('すべての一致を一括置換し、置換件数を返す', () => {
    expect(replaceAllTextMatches('A a A', 'a', 'x')).toEqual({
      value: 'x x x',
      count: 3,
    })
  })

  it('空文字への置換で一致箇所を削除する', () => {
    expect(replaceAllTextMatches('削除-削除', '削除', '')).toEqual({
      value: '-',
      count: 2,
    })
  })

  it('一致がない場合は本文を変更しない', () => {
    expect(replaceAllTextMatches('本文', 'なし', '置換')).toEqual({
      value: '本文',
      count: 0,
    })
  })
})
