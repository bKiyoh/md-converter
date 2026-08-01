import { describe, expect, it } from 'vitest'
import { parseMarkdown } from '../../../../src/parser/parseMarkdown'
import { convertToSlack, slackConverter } from '../../../../src/converters/slack/convertToSlack'

function convert(markdown: string) {
  return convertToSlack(parseMarkdown(markdown))
}

describe('convertToSlack', () => {
  it('ConverterインターフェースのSlack形式として利用できる', () => {
    expect(slackConverter.format).toBe('slack')
    expect(slackConverter.convert(parseMarkdown('本文'))).toEqual({
      output: '本文',
      warnings: [],
    })
  })

  it('空文字を警告なしの空文字へ変換する', () => {
    expect(convert('')).toEqual({ output: '', warnings: [] })
  })

  it('インライン装飾、リンク、コード、改行を入力欄向けMarkupへ変換する', () => {
    const result = convert(
      '通常 **太字** *斜体* ~~取消~~ `*code*` [公式](https://example.com)\n次の行  \n明示改行',
    )

    expect(result).toEqual({
      output:
        '通常 *太字* _斜体_ ~取消~ `*code*` [公式](https://example.com)\n次の行\n明示改行',
      warnings: [],
    })
  })

  it('見出しを太字へ変換し、見出しレベルの情報損失を警告する', () => {
    const result = convert('## 見出し')

    expect(result.output).toBe('*見出し*')
    expect(result.warnings).toEqual([
      {
        code: 'lossy-conversion',
        message: 'Slackでは見出しレベルを表現できないため、太字に変換しました。',
        location: { line: 1, column: 1 },
      },
    ])
  })

  it('箇条書き、開始番号、ネストしたリストを保持する', () => {
    const result = convert(`- 親
  3. 子A
  4. 子B
- 次`)

    expect(result).toEqual({
      output: '- 親\n  3. 子A\n  4. 子B\n- 次',
      warnings: [],
    })
  })

  it('チェックリストを状態記号へ変換して各項目を警告する', () => {
    const result = convert(`- [ ] 未完了
- [x] 完了`)

    expect(result.output).toBe('☐ 未完了\n☑ 完了')
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'lossy-conversion',
        message:
          'Slackでは操作可能なチェックボックスを表現できないため、状態を記号に変換しました。',
        location: { line: 1, column: 1 },
      }),
      expect.objectContaining({
        code: 'lossy-conversion',
        location: { line: 2, column: 1 },
      }),
    ])
  })

  it('複数段落の引用を各行の引用記法へ変換する', () => {
    const result = convert(`> 1行目
>
> 2行目`)

    expect(result).toEqual({
      output: '> 1行目\n>\n> 2行目',
      warnings: [],
    })
  })

  it('コードブロック内のMarkdown記号を変換しない', () => {
    const result = convert(`\`\`\`
# 見出し
**太字** [リンク](https://example.com)
\`\`\``)

    expect(result).toEqual({
      output: `\`\`\`
# 見出し
**太字** [リンク](https://example.com)
\`\`\``,
      warnings: [],
    })
  })

  it('コードブロックの言語名とメタ情報を省略して警告する', () => {
    const result = convert(`\`\`\`ts title="sample"
const value = 1
\`\`\``)

    expect(result.output).toBe(`\`\`\`
const value = 1
\`\`\``)
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'lossy-conversion',
        message: 'Slackのコードブロックでは言語名とメタ情報を保持できないため、省略しました。',
        location: { line: 1, column: 1 },
      }),
    ])
  })

  it('日本語テーブルをコードブロックへ変換して内容を保持する', () => {
    const result = convert(`| 項目 | 内容 |
| :--- | ---: |
| 事象 | 保存できない |
| 原因 | **空文字** |`)

    expect(result.output).toBe(`\`\`\`
| 項目 | 内容 |
| --- | --- |
| 事象 | 保存できない |
| 原因 | 空文字 |
\`\`\``)
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'lossy-conversion',
        message:
          'Slackではテーブルを直接表現できないため、コードブロック形式に変換しました。列配置とセル内装飾は保持されません。',
        location: { line: 1, column: 1 },
      }),
    ])
  })

  it('水平線を罫線文字へ変換して警告する', () => {
    const result = convert('---')

    expect(result.output).toBe('──────────')
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'lossy-conversion',
        location: { line: 1, column: 1 },
      }),
    ])
  })

  it('複数のブロック要素を空行で区切る', () => {
    const result = convert(`段落

> 引用

- 項目

---`)

    expect(result.output).toBe('段落\n\n> 引用\n\n- 項目\n\n──────────')
    expect(result.warnings).toHaveLength(1)
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
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unsupported-node',
          message: expect.stringContaining('生HTML'),
          location: { line: 1, column: 3 },
        }),
        expect.objectContaining({
          code: 'unsupported-node',
          location: { line: 3, column: 1 },
        }),
      ]),
    )
  })
})
