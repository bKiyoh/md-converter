import { describe, expect, it } from 'vitest'
import { parseMarkdown } from '../../parser/parseMarkdown'
import {
  backlogMarkdownConverter,
  convertToBacklogMarkdown,
} from './convertToBacklogMarkdown'

function convert(markdown: string) {
  return convertToBacklogMarkdown(parseMarkdown(markdown))
}

describe('convertToBacklogMarkdown', () => {
  it('ConverterインターフェースのBacklog Markdown形式として利用できる', () => {
    expect(backlogMarkdownConverter.format).toBe('backlog-markdown')
    expect(backlogMarkdownConverter.convert(parseMarkdown('本文'))).toEqual({
      output: '本文',
      warnings: [],
    })
  })

  it('空文字を警告なしの空文字へ変換する', () => {
    expect(convert('')).toEqual({ output: '', warnings: [] })
  })

  it('見出しレベル1〜6を保持する', () => {
    const result = convert(`# 見出し1
## 見出し2
### 見出し3
#### 見出し4
##### 見出し5
###### 見出し6`)

    expect(result).toEqual({
      output: `# 見出し1

## 見出し2

### 見出し3

#### 見出し4

##### 見出し5

###### 見出し6`,
      warnings: [],
    })
  })

  it('インライン装飾、リンク、コード、ソフト改行、明示改行を保持する', () => {
    const result = convert(
      '通常 **太字** *斜体* ~~取消~~ `*code*` [公式](https://example.com "説明")\nソフト  \n明示',
    )

    expect(result).toEqual({
      output:
        '通常 **太字** *斜体* ~~取消~~ `*code*` [公式](https://example.com "説明")\nソフト  \n明示',
      warnings: [],
    })
  })

  it('箇条書き、開始番号、4スペースでネストしたリストを保持する', () => {
    const result = convert(`3. 親
    - 子A
    - 子B
4. 次`)

    expect(result).toEqual({
      output: '3. 親\n    - 子A\n    - 子B\n4. 次',
      warnings: [],
    })
  })

  it('チェック状態を保持し、課題詳細だけで操作できる制約を各項目に警告する', () => {
    const result = convert(`- [ ] 未完了
- [x] 完了`)

    expect(result.output).toBe('- [ ] 未完了\n- [x] 完了')
    expect(result.warnings).toEqual([
      {
        code: 'lossy-conversion',
        message:
          'Backlogのチェックリストは課題詳細でのみ操作できます。コメントやWikiでは通常のリストとして表示される場合があります。',
        location: { line: 1, column: 1 },
      },
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

  it('コードブロック内のMarkdown記号と言語・メタ情報を保持する', () => {
    const result = convert(`\`\`\`ts title="sample"
# 見出し
**太字** [リンク](https://example.com)
\`\`\``)

    expect(result).toEqual({
      output: `\`\`\`ts title="sample"
# 見出し
**太字** [リンク](https://example.com)
\`\`\``,
      warnings: [],
    })
  })

  it('コード本文のバッククォートと衝突しない長さのフェンスを使用する', () => {
    const result = convert(`\`\`\`\`
\`\`\`
\`\`\`\``)

    expect(result.output).toBe(`\`\`\`\`
\`\`\`
\`\`\`\``)
    expect(result.warnings).toEqual([])
  })

  it('日本語テーブルの配置、セル内装飾、パイプ文字を保持する', () => {
    const result = convert(`| 項目 | 内容 |
| :--- | ---: |
| 事象 | **保存できない** |
| 原因 | A \\| B |`)

    expect(result).toEqual({
      output: `| 項目 | 内容 |
| :--- | ---: |
| 事象 | **保存できない** |
| 原因 | A \\| B |`,
      warnings: [],
    })
  })

  it('水平線をBacklog Markdownの罫線記法へ変換する', () => {
    expect(convert('***')).toEqual({ output: '---', warnings: [] })
  })

  it('複数のブロック要素を空行で区切る', () => {
    const result = convert(`段落

> 引用

- 項目

---`)

    expect(result).toEqual({
      output: '段落\n\n> 引用\n\n- 項目\n\n---',
      warnings: [],
    })
  })

  it('不完全またはエスケープされたMarkdownを別の構造へ変えず保持する', () => {
    expect(convert('\\# 見出しではない\n\n**閉じていない強調\n\n[未完了リンク](')).toEqual({
      output:
        '\\# 見出しではない\n\n\\*\\*閉じていない強調\n\n\\[未完了リンク\\](',
      warnings: [],
    })
  })
})
