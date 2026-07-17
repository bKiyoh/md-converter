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
    expect(applyMarkdownShortcut(applied?.value ?? '', 1, 3, 'italic')).toEqual({
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

  it('リンク全体またはリンク本文の選択から記法を解除する', () => {
    expect(applyMarkdownShortcut('[hoge](URL)', 0, 11, 'link')).toEqual({
      value: 'hoge',
      selectionStart: 0,
      selectionEnd: 4,
    })
    expect(applyMarkdownShortcut('[hoge](URL)', 1, 5, 'link')).toEqual({
      value: 'hoge',
      selectionStart: 0,
      selectionEnd: 4,
    })
  })

  it('取り消し線を付与・解除する', () => {
    const applied = applyMarkdownShortcut('廃止', 0, 2, 'strikethrough')
    expect(applied).toEqual({ value: '~~廃止~~', selectionStart: 2, selectionEnd: 4 })
    expect(applyMarkdownShortcut(applied?.value ?? '', 2, 4, 'strikethrough')).toEqual({
      value: '廃止',
      selectionStart: 0,
      selectionEnd: 2,
    })
  })

  it('本文中のバッククォートより長い区切りでインラインコード化する', () => {
    expect(applyMarkdownShortcut('foo`bar', 0, 7, 'inline-code')).toEqual({
      value: '``foo`bar``',
      selectionStart: 2,
      selectionEnd: 9,
    })
  })

  it('選択なしではインラインコード記号の中央へカーソルを置く', () => {
    expect(applyMarkdownShortcut('ab', 1, 1, 'inline-code')).toEqual({
      value: 'a``b',
      selectionStart: 2,
      selectionEnd: 2,
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

  it.each([
    ['KeyE', false, false, 'inline-code'],
    ['KeyX', true, false, 'strikethrough'],
    ['Digit7', true, false, 'ordered-list'],
    ['Digit8', true, false, 'bullet-list'],
    ['Digit9', true, false, 'quote'],
    ['Digit1', false, true, 'heading-1'],
  ] as const)('%sの修飾キーから%sを判定する', (code, shiftKey, altKey, expected) => {
    expect(
      getMarkdownShortcut({
        code,
        key: '',
        ctrlKey: true,
        metaKey: false,
        altKey,
        shiftKey,
        isComposing: false,
      }),
    ).toBe(expected)
  })
})

describe('行単位のショートカット', () => {
  it('選択した各行を箇条書きにして、再実行すると解除する', () => {
    const input = 'りんご\nみかん'
    const applied = applyMarkdownShortcut(input, 0, input.length, 'bullet-list')
    expect(applied).toEqual({
      value: '- りんご\n- みかん',
      selectionStart: 0,
      selectionEnd: 11,
    })
    expect(
      applyMarkdownShortcut(
        applied?.value ?? '',
        applied?.selectionStart ?? 0,
        applied?.selectionEnd ?? 0,
        'bullet-list',
      ),
    ).toEqual({ value: input, selectionStart: 0, selectionEnd: input.length })
  })

  it('一部が加工済みの場合は未加工行だけへ箇条書きを適用する', () => {
    expect(applyMarkdownShortcut('- りんご\nみかん', 0, 9, 'bullet-list')?.value).toBe(
      '- りんご\n- みかん',
    )
  })

  it('番号付きリストを1から採番し、既存の箇条書きを置き換える', () => {
    expect(applyMarkdownShortcut('- A\nB\n\nC', 0, 8, 'ordered-list')).toEqual({
      value: '1. A\n2. B\n\n3. C',
      selectionStart: 0,
      selectionEnd: 15,
    })
  })

  it('引用と見出しではインデントを維持し、空行を加工しない', () => {
    expect(applyMarkdownShortcut('  A\n\n  B', 0, 8, 'quote')?.value).toBe(
      '  > A\n\n  > B',
    )
    expect(applyMarkdownShortcut('見出し', 0, 3, 'heading-1')?.value).toBe('# 見出し')
  })

  it('選択末尾が次行の先頭の場合は次行を対象に含めない', () => {
    expect(applyMarkdownShortcut('A\nB', 0, 2, 'bullet-list')).toEqual({
      value: '- A\nB',
      selectionStart: 0,
      selectionEnd: 3,
    })
  })
})

describe('リスト入力の自動継続', () => {
  it('箇条書きの文章途中で項目を分割する', () => {
    expect(continueMarkdownList('- テスト', 3, 3)).toEqual({
      value: '- テ\n- スト',
      selectionStart: 6,
      selectionEnd: 6,
    })
  })

  it('番号付きリストの文章途中では次の番号で項目を分割する', () => {
    expect(continueMarkdownList('3. テスト', 4, 4)).toEqual({
      value: '3. テ\n4. スト',
      selectionStart: 8,
      selectionEnd: 8,
    })
  })

  it('ネストしたリストの文章途中では同じ階層を維持する', () => {
    expect(continueMarkdownList('  - テスト', 5, 5)).toEqual({
      value: '  - テ\n  - スト',
      selectionStart: 10,
      selectionEnd: 10,
    })
  })

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

  it('通常行、リスト記号内、コードブロック内ではEnterを処理しない', () => {
    expect(continueMarkdownList('通常行', 3, 3)).toBeNull()
    expect(continueMarkdownList('- item', 1, 1)).toBeNull()
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
