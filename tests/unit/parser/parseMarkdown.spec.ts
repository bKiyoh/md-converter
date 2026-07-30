import { describe, expect, it } from 'vitest'
import { parseMarkdown } from '../../../src/parser/parseMarkdown'

describe('parseMarkdown', () => {
  it('空文字を空の文書として解析する', () => {
    expect(parseMarkdown('')).toEqual({ blocks: [] })
  })

  it('MVPのブロック要素を中間表現へ正規化する', () => {
    const document = parseMarkdown(`# 見出し

段落

> 引用

- 箇条書き

3. 番号付き

---`)

    expect(document.blocks.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
      'quote',
      'list',
      'list',
      'thematicBreak',
    ])
    expect(document.blocks[0]).toMatchObject({ type: 'heading', depth: 1 })
    expect(document.blocks[3]).toMatchObject({ type: 'list', ordered: false, start: null })
    expect(document.blocks[4]).toMatchObject({ type: 'list', ordered: true, start: 3 })
  })

  it('MVPのインライン要素とリンク先を保持する', () => {
    const document = parseMarkdown(
      '通常 **太字** *斜体* ~~打ち消し~~ `code` [リンク](https://example.com "説明")',
    )
    const paragraph = document.blocks[0]

    expect(paragraph).toMatchObject({
      type: 'paragraph',
      children: [
        { type: 'text', value: '通常 ' },
        { type: 'strong', children: [{ type: 'text', value: '太字' }] },
        { type: 'text', value: ' ' },
        { type: 'emphasis', children: [{ type: 'text', value: '斜体' }] },
        { type: 'text', value: ' ' },
        { type: 'delete', children: [{ type: 'text', value: '打ち消し' }] },
        { type: 'text', value: ' ' },
        { type: 'inlineCode', value: 'code' },
        { type: 'text', value: ' ' },
        {
          type: 'link',
          url: 'https://example.com',
          title: '説明',
          children: [{ type: 'text', value: 'リンク' }],
        },
      ],
    })
  })

  it('参照形式のリンクを定義と結び付ける', () => {
    const document = parseMarkdown(`[公式サイト][official]

[official]: https://example.com "公式"`)

    expect(document.blocks).toHaveLength(1)
    expect(document.blocks[0]).toMatchObject({
      type: 'paragraph',
      children: [
        {
          type: 'link',
          url: 'https://example.com',
          title: '公式',
          children: [{ type: 'text', value: '公式サイト' }],
        },
      ],
    })
  })

  it('チェック状態とネストしたリスト構造を保持する', () => {
    const document = parseMarkdown(`- [x] 完了
  - [ ] 未完了
- 通常`)
    const list = document.blocks[0]

    expect(list).toMatchObject({
      type: 'list',
      ordered: false,
      items: [
        {
          type: 'listItem',
          checked: true,
          children: [
            { type: 'paragraph', children: [{ type: 'text', value: '完了' }] },
            {
              type: 'list',
              items: [
                {
                  type: 'listItem',
                  checked: false,
                  children: [
                    { type: 'paragraph', children: [{ type: 'text', value: '未完了' }] },
                  ],
                },
              ],
            },
          ],
        },
        { type: 'listItem', checked: null },
      ],
    })
  })

  it('コードブロック内のMarkdown記号を子ノードとして解析しない', () => {
    const document = parseMarkdown(`\`\`\`ts title="sample"
# 見出し
**太字** [リンク](https://example.com)
\`\`\``)

    expect(document.blocks).toEqual([
      expect.objectContaining({
        type: 'codeBlock',
        language: 'ts',
        meta: 'title="sample"',
        value: '# 見出し\n**太字** [リンク](https://example.com)',
      }),
    ])
  })

  it('日本語を含むGFMテーブルと列配置を保持する', () => {
    const document = parseMarkdown(`| 項目 | 内容 |
| :--- | ---: |
| 事象 | 保存できない |
| 原因 | **空文字** |`)

    expect(document.blocks[0]).toMatchObject({
      type: 'table',
      align: ['left', 'right'],
      header: {
        cells: [
          { children: [{ type: 'text', value: '項目' }] },
          { children: [{ type: 'text', value: '内容' }] },
        ],
      },
      rows: [
        {
          cells: [
            { children: [{ type: 'text', value: '事象' }] },
            { children: [{ type: 'text', value: '保存できない' }] },
          ],
        },
        {
          cells: [
            { children: [{ type: 'text', value: '原因' }] },
            { children: [{ type: 'strong', children: [{ type: 'text', value: '空文字' }] }] },
          ],
        },
      ],
    })
  })

  it('ソフト改行、明示改行、段落の区切りを区別する', () => {
    const document = parseMarkdown(`ソフト
改行  
明示

次の段落`)

    expect(document.blocks).toHaveLength(2)
    expect(document.blocks[0]).toMatchObject({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'ソフト' },
        { type: 'lineBreak', kind: 'soft' },
        { type: 'text', value: '改行' },
        { type: 'lineBreak', kind: 'hard' },
        { type: 'text', value: '明示' },
      ],
    })
    expect(document.blocks[1]).toMatchObject({
      type: 'paragraph',
      children: [{ type: 'text', value: '次の段落' }],
    })
  })

  it('不完全なMarkdownを例外にせずテキストとして保持する', () => {
    expect(parseMarkdown('**閉じていない強調\n\n[未完了リンク](')).toMatchObject({
      blocks: [
        { type: 'paragraph', children: [{ type: 'text', value: '**閉じていない強調' }] },
        { type: 'paragraph', children: [{ type: 'text', value: '[未完了リンク](' }] },
      ],
    })
  })

  it('ブロックHTMLとインラインHTMLの原文と位置を保持する', () => {
    const document = parseMarkdown(`通常 <span>インライン</span>

<div>ブロック</div>`)

    expect(document.blocks).toMatchObject([
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: '通常 ' },
          {
            type: 'rawHtmlInline',
            value: '<span>',
            location: { line: 1, column: 4 },
          },
          { type: 'text', value: 'インライン' },
          { type: 'rawHtmlInline', value: '</span>' },
        ],
      },
      {
        type: 'rawHtmlBlock',
        value: '<div>ブロック</div>',
        location: { line: 3, column: 1 },
      },
    ])
  })

  it('開始位置を警告に利用できる最小情報として保持する', () => {
    const document = parseMarkdown('\n# 見出し')

    expect(document.blocks[0]).toMatchObject({ location: { line: 2, column: 1 } })
  })
})
