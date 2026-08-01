import { describe, expect, it } from 'vitest'
import { parseMarkdown } from '../../../../src/parser/parseMarkdown'
import {
  backlogNotationConverter,
  convertToBacklogNotation,
} from '../../../../src/converters/backlog-notation/convertToBacklogNotation'

function convert(markdown: string) {
  return convertToBacklogNotation(parseMarkdown(markdown))
}

describe('convertToBacklogNotation', () => {
  it('ConverterインターフェースのBacklog記法形式として利用できる', () => {
    expect(backlogNotationConverter.format).toBe('backlog-notation')
    expect(backlogNotationConverter.convert(parseMarkdown('本文'))).toEqual({
      output: '本文',
      warnings: [],
    })
  })

  it('空文字を警告なしの空文字へ変換する', () => {
    expect(convert('')).toEqual({ output: '', warnings: [] })
  })

  it('見出しレベル1〜3を保持し、4〜6をレベル3へ変換して警告する', () => {
    const result = convert(`# 見出し1
## 見出し2
### 見出し3
#### 見出し4
##### 見出し5
###### 見出し6`)

    expect(result.output).toBe(`* 見出し1

** 見出し2

*** 見出し3

*** 見出し4

*** 見出し5

*** 見出し6`)
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'lossy-conversion',
        location: { line: 4, column: 1 },
      }),
      expect.objectContaining({
        code: 'lossy-conversion',
        location: { line: 5, column: 1 },
      }),
      expect.objectContaining({
        code: 'lossy-conversion',
        location: { line: 6, column: 1 },
      }),
    ])
  })

  it('装飾、リンク、ソフト改行、明示改行をBacklog記法へ変換する', () => {
    const result = convert(
      '通常 **太字** *斜体* ~~取消~~ [公式](https://example.com)\nソフト  \n明示',
    )

    expect(result).toEqual({
      output:
        "通常 ''太字'' '''斜体''' %%取消%% [[公式:https://example.com]]&br;ソフト&br;明示",
      warnings: [],
    })
  })

  it('画像だけを代替テキストへ変換し、前後の本文を保持する', () => {
    const result = convert('本文\n\n![説明](image.png)\n\n続き')

    expect(result.output).toBe('本文\n\n画像: 説明 (image.png)\n\n続き')
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'unsupported-image',
        location: { line: 3, column: 1 },
      }),
    ])
  })

  it('インラインコードをプレーンテキスト化し、リンクタイトルを省略して警告する', () => {
    const result = convert('`*code*` [公式](https://example.com "説明")')

    expect(result.output).toBe('\\\\*code\\\\* [[公式:https://example.com]]')
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'lossy-conversion',
        message: expect.stringContaining('インラインコード'),
        location: { line: 1, column: 1 },
      }),
      expect.objectContaining({
        code: 'lossy-conversion',
        message: expect.stringContaining('タイトル'),
      }),
    ])
  })

  it('公式確認できない装飾の入れ子をプレーンテキスト化して警告する', () => {
    const result = convert('**太字の中に *斜体***')

    expect(result.output).toBe("''太字の中に 斜体''")
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'lossy-conversion',
        message: expect.stringContaining('装飾の入れ子'),
      }),
    ])
  })

  it('箇条書きと番号付きリストのネストを記号の個数で表す', () => {
    const result = convert(`- 親
  - 子
    - 孫

1. 番号
   1. 子番号`)

    expect(result).toEqual({
      output: '- 親\n-- 子\n--- 孫\n\n+ 番号\n++ 子番号',
      warnings: [],
    })
  })

  it('番号付きリストの開始番号が失われる場合に警告する', () => {
    const result = convert(`3. 三番目
4. 四番目`)

    expect(result.output).toBe('+ 三番目\n+ 四番目')
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'lossy-conversion',
        message: expect.stringContaining('開始番号'),
        location: { line: 1, column: 1 },
      }),
    ])
  })

  it('チェック状態とネストを保持し、課題詳細だけで操作できる制約を警告する', () => {
    const result = convert(`- [ ] 未完了
  - [x] 完了`)

    expect(result.output).toBe('- [ ] 未完了\n-- [x] 完了')
    expect(result.warnings).toHaveLength(2)
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

  it('複数段落の引用を各行の引用記法へ変換する', () => {
    const result = convert(`> 1行目
>
> 2行目`)

    expect(result).toEqual({
      output: '>1行目\n>\n>2行目',
      warnings: [],
    })
  })

  it('公式確認済みの言語とコードブロック内のMarkdown記号を保持する', () => {
    const result = convert(`\`\`\`java
# 見出し
**太字** [リンク](https://example.com)
\`\`\``)

    expect(result).toEqual({
      output: `{code:java}
# 見出し
**太字** [リンク](https://example.com)
{/code}`,
      warnings: [],
    })
  })

  it('未確認のコード言語とメタ情報を省略して警告する', () => {
    const result = convert(`\`\`\`ts title="sample"
const value = 1
\`\`\``)

    expect(result.output).toBe(`{code}
const value = 1
{/code}`)
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'lossy-conversion',
        message: expect.stringContaining('言語名またはメタ情報'),
        location: { line: 1, column: 1 },
      }),
    ])
  })

  it('日本語テーブルをヘッダー付き記法へ変換し、列配置の損失を警告する', () => {
    const result = convert(`| 項目 | 内容 |
| :--- | ---: |
| 事象 | **保存できない** |
| 原因 | A \\| B |`)

    expect(result.output).toBe(`| 項目 | 内容 |h
| 事象 | ''保存できない'' |
| 原因 | A \\\\| B |`)
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'lossy-conversion',
        message: expect.stringContaining('列配置'),
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
        message: expect.stringContaining('水平線'),
        location: { line: 1, column: 1 },
      }),
    ])
  })

  it('複数のブロック要素を空行で区切る', () => {
    const result = convert(`段落

> 引用

- 項目`)

    expect(result).toEqual({
      output: '段落\n\n>引用\n\n- 項目',
      warnings: [],
    })
  })

  it('不完全またはエスケープされたMarkdownを別の構造へ変えず保持する', () => {
    expect(convert('\\# 見出しではない\n\n**閉じていない強調\n\n[未完了リンク](')).toEqual({
      output:
        '\\\\# 見出しではない\n\n\\\\*\\\\*閉じていない強調\n\n\\\\[未完了リンク\\\\](',
      warnings: [],
    })
  })

  it('生HTMLをエスケープした文字列として保持し、他の内容を変換しながら警告する', () => {
    const result = convert(`前 <span>内</span>

<div>テスト</div>

後`)

    expect(result.output).toBe(
      '前 <span\\\\>内</span\\\\>\n\n<div\\\\>テスト</div\\\\>\n\n後',
    )
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
