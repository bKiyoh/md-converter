import { describe, expect, it } from 'vitest'
import { parseMarkdown } from '../parser/parseMarkdown'
import {
  normalizeFullWidthMarkdownInput,
  normalizeInsertedFullWidthMarkdown,
} from './fullWidthMarkdown'

function normalize(value: string, caret = value.length): string {
  return (
    normalizeFullWidthMarkdownInput(value, caret, caret)?.value ?? value
  )
}

function normalizeInserted(value: string): string {
  return (
    normalizeInsertedFullWidthMarkdown(
      value,
      0,
      value.length,
      value.length,
      value.length,
    )?.value ?? value
  )
}

describe('normalizeFullWidthMarkdownInput', () => {
  it.each([
    ['＃', '#'],
    ['＊', '*'],
    ['＿', '_'],
    ['～', '~'],
    ['－', '-'],
    ['ー', '-'],
    ['＋', '+'],
    ['＞', '>'],
    ['｀', '`'],
    ['［', '['],
    ['］', ']'],
    ['（', '('],
    ['）', ')'],
    ['｜', '|'],
    ['：', ':'],
    ['１．', '1.'],
  ])('入力したMarkdown記号 %s を即座に %s へ補正する', (input, expected) => {
    expect(normalizeInserted(input)).toBe(expected)
  })

  it('行頭記号の後ろに入力した全角空白を即座に半角化する', () => {
    expect(normalizeInserted('＃　')).toBe('# ')
    expect(normalizeInserted('ー　')).toBe('- ')
    expect(normalizeInserted('１．　')).toBe('1. ')
  })

  it.each([
    ['＃　見出し', '# 見出し'],
    ['＃＃ 見出し', '## 見出し'],
    ['－　項目', '- 項目'],
    ['ー', '-'],
    ['ー　項目', '- 項目'],
    ['＋ 項目', '+ 項目'],
    ['＊　項目', '* 項目'],
    ['１．　項目', '1. 項目'],
    ['－　［　］　未完了', '- [ ] 未完了'],
    ['－　［Ｘ］　完了', '- [x] 完了'],
    ['＞　引用', '> 引用'],
    ['－－－', '---'],
  ])('行頭構文の %s を %s へ補正する', (input, expected) => {
    expect(normalize(input)).toBe(expected)
  })

  it.each([
    ['＊＊重要＊＊', '**重要**'],
    ['＊補足＊', '*補足*'],
    ['＿補足＿', '_補足_'],
    ['～～廃止～～', '~~廃止~~'],
    ['｀code｀', '`code`'],
    ['［名称］（https://example.com）', '[名称](https://example.com)'],
  ])('インライン構文の %s を %s へ補正する', (input, expected) => {
    expect(normalize(input)).toBe(expected)
  })

  it('コードフェンスとテーブルを補正する', () => {
    expect(normalize('｀｀｀ts')).toBe('```ts')
    expect(normalize('～～～')).toBe('~~~')
    expect(normalize('｜ 項目 ｜ 内容 ｜')).toBe('| 項目 | 内容 |')
    expect(normalize('｜：－－－｜－－－：｜')).toBe('|:---|---:|')
  })

  it('補正後の構文を既存ParserがMarkdownとして解析する', () => {
    const heading = parseMarkdown(normalize('＃　見出し'))
    const list = parseMarkdown(normalize('－　項目'))
    const emphasis = parseMarkdown(normalize('＊補足＊'))

    expect(heading.blocks[0]?.type).toBe('heading')
    expect(list.blocks[0]?.type).toBe('list')
    expect(emphasis.blocks[0]).toMatchObject({
      type: 'paragraph',
      children: [{ type: 'emphasis' }],
    })
  })

  it.each([
    'C＃のコード',
    'ケーキ',
    '価格は１，０００円',
    '文章中の（括弧）',
    '注記｜補足',
    '＊閉じていない装飾',
    '先頭ではない－　項目',
    '全角　空白',
  ])('Markdownとして成立しない全角文字を変更しない: %s', (input) => {
    expect(normalizeFullWidthMarkdownInput(input, input.length, input.length)).toBeNull()
  })

  it('既存のコード内を変更せず、同じ行のコード外だけを補正する', () => {
    const input = '`＊code＊` と ＊補足＊'

    expect(normalize(input)).toBe('`＊code＊` と *補足*')
    expect(normalize('```\n＃　見出し\n```', 10)).toBe(
      '```\n＃　見出し\n```',
    )
  })

  it('コードブロック内へ入力した全角Markdown記号を即時補正しない', () => {
    const input = '```\n＊\n```'
    const markerIndex = input.indexOf('＊')

    expect(
      normalizeInsertedFullWidthMarkdown(
        input,
        markerIndex,
        markerIndex + 1,
        markerIndex + 1,
        markerIndex + 1,
      ),
    ).toBeNull()
  })

  it('全角の閉じフェンスはコードブロック内でも補正する', () => {
    const input = '```\ncode\n｀｀｀'

    expect(normalize(input)).toBe('```\ncode\n```')
  })

  it('選択範囲がある場合は補正しない', () => {
    expect(normalizeFullWidthMarkdownInput('＊補足＊', 0, 4)).toBeNull()
  })
})
