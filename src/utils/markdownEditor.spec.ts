import { describe, expect, it } from 'vitest'
import {
  applyMarkdownShortcut,
  changeMarkdownListIndent,
  continueMarkdownList,
  getMarkdownShortcut,
} from './markdownEditor'

describe('Markdownショートカット', () => {
  it('選択文字列へ太字を付与し、本文の選択を維持する', () => {
    expect(applyMarkdownShortcut('hoge', 0, 4, 'bold')).toEqual({
      value: '**hoge**',
      selectionStart: 2,
      selectionEnd: 6,
    })
  })

  it('選択なしでは太字記号の中央へカーソルを置く', () => {
    expect(applyMarkdownShortcut('ab', 1, 1, 'bold')).toEqual({
      value: 'a****b',
      selectionStart: 3,
      selectionEnd: 3,
    })
  })

  it('選択文字列の外側にある太字記法を解除する', () => {
    expect(applyMarkdownShortcut('**hoge**', 2, 6, 'bold')).toEqual({
      value: 'hoge',
      selectionStart: 0,
      selectionEnd: 4,
    })
  })

  it('斜体記法を付与・解除する', () => {
    const applied = applyMarkdownShortcut('補足', 0, 2, 'italic')
    expect(applied).toEqual({ value: '*補足*', selectionStart: 1, selectionEnd: 3 })
    expect(applyMarkdownShortcut(applied.value, 1, 3, 'italic')).toEqual({
      value: '補足',
      selectionStart: 0,
      selectionEnd: 2,
    })
  })

  it('選択文字列へリンクを挿入してURLを選択する', () => {
    expect(applyMarkdownShortcut('hoge', 0, 4, 'link')).toEqual({
      value: '[hoge](URL)',
      selectionStart: 7,
      selectionEnd: 10,
    })
  })

  it('選択なしではリンクテキスト位置へカーソルを置く', () => {
    expect(applyMarkdownShortcut('', 0, 0, 'link')).toEqual({
      value: '[](URL)',
      selectionStart: 1,
      selectionEnd: 1,
    })
  })

  it('CtrlとCommandを判定し、IME変換中は処理しない', () => {
    expect(
      getMarkdownShortcut({ key: 'b', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, isComposing: false }),
    ).toBe('bold')
    expect(
      getMarkdownShortcut({ key: 'I', ctrlKey: false, metaKey: true, altKey: false, shiftKey: false, isComposing: false }),
    ).toBe('italic')
    expect(
      getMarkdownShortcut({ key: 'k', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, isComposing: true }),
    ).toBeNull()
  })
})

describe('リスト入力の自動継続', () => {
  it.each([
    ['- item', '- item\n- '],
    ['* item', '* item\n* '],
    ['+ item', '+ item\n+ '],
  ])('%s と同じ箇条書き記号を継続する', (input, expected) => {
    expect(continueMarkdownList(input, input.length, input.length)?.value).toBe(expected)
  })

  it.each([
    ['1. item', '1. item\n2. '],
    ['19. item', '19. item\n20. '],
  ])('%s の番号を1増やす', (input, expected) => {
    expect(continueMarkdownList(input, input.length, input.length)?.value).toBe(expected)
  })

  it('ネスト状態を維持する', () => {
    const input = '- 親\n  - 子'
    expect(continueMarkdownList(input, input.length, input.length)?.value).toBe(
      '- 親\n  - 子\n  - ',
    )
  })

  it('最上位の空リストを終了する', () => {
    const input = '- hoge\n- '
    expect(continueMarkdownList(input, input.length, input.length)).toEqual({
      value: '- hoge\n\n',
      selectionStart: 8,
      selectionEnd: 8,
    })
  })

  it('ネストされた空リストを1階層浅くする', () => {
    const input = '- 親\n  - 子\n  - '
    expect(continueMarkdownList(input, input.length, input.length)?.value).toBe('- 親\n  - 子\n- ')
  })

  it('通常行、行末以外、コードブロック内ではEnterを処理しない', () => {
    expect(continueMarkdownList('通常行', 3, 3)).toBeNull()
    expect(continueMarkdownList('- item', 2, 2)).toBeNull()
    const code = '```\n- item\n```'
    expect(continueMarkdownList(code, 10, 10)).toBeNull()
  })
})

describe('Tabによるリスト階層変更', () => {
  it('リスト項目を1階層深くし、Shift+Tabで浅くする', () => {
    const input = '- 親\n- 子'
    const indented = changeMarkdownListIndent(input, input.length, input.length, 'indent')
    expect(indented).toEqual({
      value: '- 親\n  - 子',
      selectionStart: input.length + 2,
      selectionEnd: input.length + 2,
    })
    expect(
      changeMarkdownListIndent(
        indented?.value ?? '',
        indented?.selectionStart ?? 0,
        indented?.selectionEnd ?? 0,
        'outdent',
      ),
    ).toEqual({ value: input, selectionStart: input.length, selectionEnd: input.length })
  })

  it('最上位ではそれ以上浅くしない', () => {
    expect(changeMarkdownListIndent('- item', 6, 6, 'outdent')).toEqual({
      value: '- item',
      selectionStart: 6,
      selectionEnd: 6,
    })
  })

  it('複数行をまとめてインデントし、変更後の行全体を選択する', () => {
    const input = '- 親\n- 子1\n- 子2'
    expect(changeMarkdownListIndent(input, 4, input.length, 'indent')).toEqual({
      value: '- 親\n  - 子1\n  - 子2',
      selectionStart: 4,
      selectionEnd: 17,
    })
  })

  it('複数行から最大1階層分を削除する', () => {
    const input = '- 親\n  - 子1\n - 子2'
    expect(changeMarkdownListIndent(input, 4, input.length, 'outdent')).toEqual({
      value: '- 親\n- 子1\n- 子2',
      selectionStart: 4,
      selectionEnd: 13,
    })
  })

  it('通常行とコードブロック内ではTabを処理しない', () => {
    expect(changeMarkdownListIndent('通常行', 3, 3, 'indent')).toBeNull()
    const code = '```\n- item\n```'
    expect(changeMarkdownListIndent(code, 10, 10, 'indent')).toBeNull()
  })
})
