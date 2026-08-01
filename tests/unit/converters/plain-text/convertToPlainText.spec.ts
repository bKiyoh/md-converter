import { describe, expect, it } from 'vitest'
import { parseMarkdown } from '../../../../src/parser/parseMarkdown'
import {
  convertToPlainText,
  plainTextConverter,
} from '../../../../src/converters/plain-text/convertToPlainText'

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

  it('見出しレベル1〜3を異なる表現へ警告なしで変換する', () => {
    expect(convert('# 見出し1\n\n## 見出し2\n\n### 見出し3')).toEqual({
      output: '【見出し1】\n\n■ 見出し2\n\n▼ 見出し3',
      warnings: [],
    })
  })

  it('見出しレベル4〜6を共通の小見出し表現へ変換し、各見出しを警告する', () => {
    const result = convert('#### 見出し4\n\n##### 見出し5\n\n###### 見出し6')

    expect(result.output).toBe('● 見出し4\n\n● 見出し5\n\n● 見出し6')
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'lossy-conversion',
        message: expect.stringContaining('レベル4以降'),
        location: { line: 1, column: 1 },
      }),
      expect.objectContaining({
        code: 'lossy-conversion',
        message: expect.stringContaining('レベル4以降'),
        location: { line: 3, column: 1 },
      }),
      expect.objectContaining({
        code: 'lossy-conversion',
        message: expect.stringContaining('レベル4以降'),
        location: { line: 5, column: 1 },
      }),
    ])
  })

  it('見出しと他のブロックの間を1行の空行で区切り、先頭と末尾へ余分な空行を作らない', () => {
    expect(convert('\n\n前の本文\n\n\n# 見出し\n\n\n後の本文\n\n')).toEqual({
      output: '前の本文\n\n【見出し】\n\n後の本文',
      warnings: [],
    })
  })

  it('文中の太字をかぎ括弧にし、斜体と打ち消し線の記号だけを警告なしで除去する', () => {
    expect(convert('これは**重要**で、*補足*と~~廃止~~を含みます。')).toEqual({
      output: 'これは「重要」で、補足と廃止を含みます。',
      warnings: [],
    })
  })

  it('太字だけで構成された段落を隅付き括弧で表し、見出しの警告を返さない', () => {
    expect(convert('**重要**')).toEqual({ output: '【重要】', warnings: [] })
  })

  it('インラインコードのバッククォートとコード本文を警告なしで保持する', () => {
    expect(convert('`npm run dev` を実行します。')).toEqual({
      output: '`npm run dev` を実行します。',
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

  it('箇条書き記号をハイフンに統一し、1階層2スペースのネストを保持する', () => {
    const result = convert(`* 親
  + 子
    * 孫

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

  it('引用の空行を保ち、各行へ引用記号を付ける', () => {
    expect(convert('> 1行目\n>\n> 2行目')).toEqual({
      output: '> 1行目\n>\n> 2行目',
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

  it('2列テーブルの見出し行を省略し、データ行を項目と値の形式へ変換する', () => {
    expect(
      convert(`| 項目 | 内容 |
| --- | --- |
| 名前 | Md Converter |
| 対象 | Slack、Backlog |`),
    ).toEqual({
      output: '名前：Md Converter\n対象：Slack、Backlog',
      warnings: [],
    })
  })

  it('データ行がない2列テーブルは内容を失わず、見出し行をタブ区切りで出力する', () => {
    expect(
      convert(`| 項目 | 内容 |
| --- | --- |`),
    ).toEqual({
      output: '項目\t内容',
      warnings: [],
    })
  })

  it('3列以上の日本語テーブルを見出し行を含むタブ区切りへ変換する', () => {
    expect(
      convert(`| 名前 | 状態 | 担当 |
| --- | --- | --- |
| 変換機能 | 完了 | 田中 |`),
    ).toEqual({
      output: '名前\t状態\t担当\n変換機能\t完了\t田中',
      warnings: [],
    })
  })

  it('テーブルの列配置とセル内装飾の消失をテーブルごとに1件警告する', () => {
    const result = convert(`| 項目 | 内容 |
| :--- | ---: |
| 事象 | **保存できない** |
| 原因 | A \\| B |`)

    expect(result.output).toBe(
      '事象：保存できない\n原因：A | B',
    )
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'lossy-conversion',
        message: expect.stringContaining('列配置'),
        location: { line: 1, column: 1 },
      }),
    ])
  })

  it('配置指定がなくてもテーブルのセル内装飾が失われる場合は警告する', () => {
    const result = convert(`| 項目 | 内容 |
| --- | --- |
| 状態 | *完了* |`)

    expect(result.output).toBe('状態：完了')
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'lossy-conversion',
        message: expect.stringContaining('セル内装飾'),
        location: { line: 1, column: 1 },
      }),
    ])
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

  it('水平線の前後を他のブロックと1行の空行で区切る', () => {
    expect(convert('前\n\n---\n\n後')).toEqual({
      output: '前\n\n──────────\n\n後',
      warnings: [],
    })
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
