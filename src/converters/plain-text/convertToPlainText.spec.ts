import { describe, expect, it } from 'vitest'
import { parseMarkdown } from '../../parser/parseMarkdown'
import { convertToPlainText, plainTextConverter } from './convertToPlainText'

function convert(markdown: string) {
  return convertToPlainText(parseMarkdown(markdown))
}

describe('convertToPlainText', () => {
  it('Converterインターフェースのプレーンテキスト形式として利用できる', () => {
    expect(plainTextConverter.format).toBe('plain-text')
    expect(plainTextConverter.convert(parseMarkdown('本文'))).toEqual({
      output: '本文',
      warnings: [],
    })
  })

  it('空文字を警告なしの空文字へ変換する', () => {
    expect(convert('')).toEqual({ output: '', warnings: [] })
  })

  it('見出しを共通の括弧表現へ変換し、見出しごとにレベル消失を警告する', () => {
    const result = convert('# 見出し1\n\n### 見出し3')

    expect(result.output).toBe('【見出し1】\n\n【見出し3】')
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'lossy-conversion',
        message: expect.stringContaining('見出しレベル'),
        location: { line: 1, column: 1 },
      }),
      expect.objectContaining({
        code: 'lossy-conversion',
        message: expect.stringContaining('見出しレベル'),
        location: { line: 3, column: 1 },
      }),
    ])
  })

  it('通常の装飾とインラインコードは本文だけを警告なしで保持する', () => {
    expect(convert('通常 **太字の中に *斜体*** ~~取消~~ `*code*`')).toEqual({
      output: '通常 太字の中に 斜体 取消 *code*',
      warnings: [],
    })
  })

  it('リンクの表示名とURLを保持し、タイトルの省略をリンクごとに警告する', () => {
    const result = convert(
      '[通常](https://example.com) [説明付き](https://example.jp "タイトル")',
    )

    expect(result.output).toBe(
      '通常（https://example.com） 説明付き（https://example.jp）',
    )
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'lossy-conversion',
        message: expect.stringContaining('リンクタイトル'),
        location: { line: 1, column: 27 },
      }),
    ])
  })

  it('開始番号と1階層2スペースのネストを保持する', () => {
    const result = convert(`- 親
  - 子
    - 孫

3. 三番目
4. 四番目`)

    expect(result).toEqual({
      output: '- 親\n  - 子\n    - 孫\n\n3. 三番目\n4. 四番目',
      warnings: [],
    })
  })

  it('チェック状態を記号で保持し、チェック項目ごとに警告する', () => {
    const result = convert('- [ ] 未完了\n  - [x] 完了')

    expect(result.output).toBe('□ 未完了\n  ■ 完了')
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'lossy-conversion',
        location: { line: 1, column: 1 },
      }),
      expect.objectContaining({
        code: 'lossy-conversion',
        location: { line: 2, column: 3 },
      }),
    ])
  })

  it('引用の空行を保ち、空行以外の各行へ引用ラベルを付ける', () => {
    expect(convert('> 1行目\n>\n> 2行目')).toEqual({
      output: '引用：1行目\n\n引用：2行目',
      warnings: [],
    })
  })

  it('コードブロック内のMarkdown記号、改行、空白を4スペース字下げで保持する', () => {
    const result = convert(`\`\`\`
# 見出し
  **太字**

末尾
\`\`\``)

    expect(result).toEqual({
      output: '    # 見出し\n      **太字**\n    \n    末尾',
      warnings: [],
    })
  })

  it('言語名とメタ情報をまとめてコードブロックごとに1件警告する', () => {
    const result = convert(`\`\`\`ts title="sample"
const value = 1
\`\`\``)

    expect(result.output).toBe('    const value = 1')
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'lossy-conversion',
        message: expect.stringContaining('言語名またはメタ情報'),
        location: { line: 1, column: 1 },
      }),
    ])
  })

  it('日本語テーブルをタブ区切りにし、列配置の消失をテーブルごとに警告する', () => {
    const result = convert(`| 項目 | 内容 |
| :--- | ---: |
| 事象 | **保存できない** |
| 原因 | A \\| B |`)

    expect(result.output).toBe(
      '項目\t内容\n事象\t保存できない\n原因\tA | B',
    )
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'lossy-conversion',
        message: expect.stringContaining('列配置'),
        location: { line: 1, column: 1 },
      }),
    ])
  })

  it('配置指定と装飾がないテーブルは警告なしでセル内容を保持する', () => {
    expect(convert('| 名前 | 値 |\n| --- | --- |\n| 日本語 | 10 |')).toEqual({
      output: '名前\t値\n日本語\t10',
      warnings: [],
    })
  })

  it('ソフト改行と明示改行を保持し、ブロック間を空行で区切る', () => {
    expect(convert('ソフト\n改行  \n明示\n\n次の段落')).toEqual({
      output: 'ソフト\n改行\n明示\n\n次の段落',
      warnings: [],
    })
  })

  it('水平線を罫線文字へ警告なしで変換する', () => {
    expect(convert('---')).toEqual({ output: '──────────', warnings: [] })
  })

  it('不完全なMarkdownをテキストとして欠落させない', () => {
    expect(convert('**閉じていない強調\n\n[未完了リンク](')).toEqual({
      output: '**閉じていない強調\n\n[未完了リンク](',
      warnings: [],
    })
  })

  it('生HTMLを文字列として保持し、他の内容を変換しながら警告する', () => {
    const result = convert(`前 <span>内</span>

<div>テスト</div>

後`)

    expect(result.output).toBe('前 <span>内</span>\n\n<div>テスト</div>\n\n後')
    expect(result.warnings).toHaveLength(3)
    expect(result.warnings.every((warning) => warning.code === 'unsupported-node')).toBe(true)
    expect(result.warnings[2]).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('生HTML'),
        location: { line: 3, column: 1 },
      }),
    )
  })
})
